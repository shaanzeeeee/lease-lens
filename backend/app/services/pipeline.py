"""
Pipeline service: Shared background task for document OCR + AI agent processing.
Extracted here to avoid circular imports between agents.py and documents.py.
"""
import logging
import asyncio
import aiofiles
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Document, Deal, DocumentStatus, DealStage
from app.agents.graph import run_pipeline
from app.services.ocr import extract_text_from_file
from app.services.vectorstore import upsert_document
from app.services.structuring import suggest_filename
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


async def notify_pipeline_clients(property_id: int, message: dict):
    """
    Notify WebSocket clients of pipeline status changes.
    Imports lazily to avoid circular imports.
    """
    try:
        from app.routers.agents import notify_clients
        await notify_clients(property_id, message)
    except Exception as e:
        logger.warning(f"Failed to notify WebSocket clients: {e}")


async def process_document_background(doc_id: int, tenant_id: int):
    """
    Background task: run the full ingestion + agent pipeline for a document.
    This is the shared implementation used by both auto-upload and manual trigger.
    """
    from app.database import async_session

    async with async_session() as db:
        try:
            result = await db.execute(select(Document).where(Document.id == doc_id))
            doc = result.scalar_one_or_none()
            if not doc:
                logger.warning(f"Document {doc_id} not found for pipeline processing")
                return

            # ── Step 1: OCR / text extraction ─────────────────────────────
            if not doc.ocr_text:
                logger.info(f"Step 1: Extracting text for doc {doc_id} ({doc.file_type})")
                async with aiofiles.open(doc.file_path, "rb") as f:
                    file_bytes = await f.read()

                await notify_pipeline_clients(
                    doc.property_id,
                    {"document_id": doc_id, "status": "processing", "stage": "ocr"},
                )
                ocr_result = await extract_text_from_file(file_bytes, doc.file_type or "pdf")

                doc.ocr_text = ocr_result["text"]
                doc.ocr_confidence = ocr_result["confidence"]
                doc.ocr_blocks = ocr_result["blocks"]

                # HITL: flag documents below confidence threshold
                threshold = settings.OCR_CONFIDENCE_THRESHOLD
                if ocr_result["confidence"] < threshold and ocr_result["confidence"] > 0:
                    doc.status = DocumentStatus.NEEDS_REVIEW.value
                    await db.commit()
                    logger.info(
                        f"Doc {doc_id}: low confidence ({ocr_result['confidence']}%), flagged for review"
                    )
                    await notify_pipeline_clients(
                        doc.property_id,
                        {"document_id": doc_id, "status": "needs_review", "stage": "low_confidence_ocr"},
                    )
                    return

                await db.commit()

            # ── Step 2: AI agent pipeline ──────────────────────────────────
            await notify_pipeline_clients(
                doc.property_id,
                {"document_id": doc_id, "status": "processing", "stage": "ai_pipeline"},
            )
            pipeline_result = await run_pipeline(
                document_id=doc.id,
                property_id=doc.property_id,
                tenant_id=tenant_id,
                raw_text=doc.ocr_text,
                filename=doc.original_filename,
                file_type=doc.file_type or "pdf",
            )

            # ── Step 3: Update document with AI results ────────────────────
            ai_category = pipeline_result.get("category", doc.category)
            ai_subcategory = pipeline_result.get("subcategory", doc.subcategory)

            doc.ai_category = ai_category
            # Preserving the original doc.category/subcategory derived from folder upload
            doc.ai_summary = pipeline_result.get("summary", "")
            doc.updated_at = datetime.utcnow()

            # ── Step 4: AI-driven filename suggestion ──────────────────────
            if doc.ocr_text:
                try:
                    suggested_name = await suggest_filename(
                        current_name=doc.original_filename,
                        text=doc.ocr_text,
                        category=ai_category or "other",
                        subcategory=ai_subcategory or "",
                    )
                    if suggested_name and suggested_name != doc.original_filename:
                        logger.info(
                            f"AI renamed doc {doc_id}: '{doc.original_filename}' → '{suggested_name}'"
                        )
                        doc.original_filename = suggested_name
                except Exception as rename_err:
                    logger.warning(f"AI rename failed for doc {doc_id}: {rename_err}")

            if pipeline_result.get("requires_human_review"):
                doc.status = DocumentStatus.NEEDS_REVIEW.value
                await db.commit()
                logger.info(f"Doc {doc_id} pipeline halted for human review")
                await notify_pipeline_clients(
                    doc.property_id,
                    {"document_id": doc_id, "status": "needs_review", "stage": "human_review"},
                )
                return

            doc.status = DocumentStatus.VERIFIED.value

            # ── Step 5: Create or update Deal ────────────────────────────
            extracted = pipeline_result.get("extracted_data", {})
            underwriting = pipeline_result.get("underwriting_result", {})
            financials = extracted.get("financials", {})

            deal = Deal(
                property_id=doc.property_id,
                document_id=doc.id,
                deal_name=f"Deal — {doc.original_filename}",
                stage=DealStage.COMPLETE.value,
                purchase_price=financials.get("purchase_price"),
                asking_price=financials.get("asking_price"),
                noi=underwriting.get("noi") or financials.get("noi"),
                cap_rate=underwriting.get("cap_rate") or financials.get("cap_rate"),
                gross_revenue=financials.get("gross_revenue"),
                operating_expenses=financials.get("operating_expenses"),
                cash_on_cash=underwriting.get("cash_on_cash"),
                price_per_unit=underwriting.get("price_per_unit"),
                grm=underwriting.get("grm"),
                structured_data=extracted,
                lease_summary=extracted.get("lease_terms", []),
                expense_breakdown=extracted.get("expense_items", {}),
                ai_summary=pipeline_result.get("summary", ""),
                ai_report=pipeline_result.get("report", ""),
                pipeline_log=[],
                validation_errors=pipeline_result.get("validation_errors", []),
                completed_at=datetime.utcnow(),
            )
            db.add(deal)

            # ── Step 6: Index in vector store ─────────────────────────────
            await upsert_document(
                doc_id=doc.id,
                text=doc.ocr_text,
                metadata={
                    "property_id": doc.property_id,
                    "filename": doc.original_filename,
                    "category": doc.category,
                },
                tenant_id=tenant_id,
            )

            await db.commit()
            logger.info(f"Pipeline complete for doc {doc_id}")
            await notify_pipeline_clients(
                doc.property_id,
                {"document_id": doc_id, "status": "verified", "stage": "complete"},
            )

        except Exception as e:
            logger.error(f"❌ Pipeline failed for doc {doc_id}: {str(e)}", exc_info=True)
            await db.rollback()
            # Update doc status to failed in a fresh session
            try:
                from app.database import async_session as fresh_session
                async with fresh_session() as error_db:
                    result = await error_db.execute(select(Document).where(Document.id == doc_id))
                    error_doc = result.scalar_one_or_none()
                    if error_doc:
                        error_doc.status = DocumentStatus.FAILED.value
                        error_doc.error_message = str(e)
                        await error_db.commit()
            except Exception as e2:
                logger.error(f"Failed to update document status to FAILED: {e2}")

            # Notify clients of failure
            try:
                pid = None
                if "doc" in dir() and doc:
                    pid = doc.property_id
                else:
                    from app.database import async_session as fetch_session
                    async with fetch_session() as fetch_db:
                        res = await fetch_db.execute(select(Document).where(Document.id == doc_id))
                        d = res.scalar_one_or_none()
                        if d:
                            pid = d.property_id

                if pid:
                    await notify_pipeline_clients(
                        pid,
                        {
                            "document_id": doc_id,
                            "status": "failed",
                            "stage": "error",
                            "error": str(e),
                        },
                    )
            except Exception as e3:
                logger.error(f"Failed to notify clients of error: {e3}")
