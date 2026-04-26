"""
Agents router: Trigger and monitor the LangGraph document processing pipeline.
"""
import logging
import asyncio
import aiofiles
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Document, Deal, Property, DocumentStatus, DealStage
from app.auth import get_current_user, User
from app.agents.graph import run_pipeline
from app.services.ocr import extract_text_from_file
from app.services.vectorstore import upsert_document
from app.config import get_settings
from app.worker import process_document_task

logger = logging.getLogger(__name__)
settings = get_settings()
router = APIRouter(prefix="/api/agents", tags=["AI Agents"])

active_connections: dict[int, list[WebSocket]] = {}

async def notify_clients(property_id: int, message: dict):
    if property_id in active_connections:
        dead_connections = []
        for connection in active_connections[property_id]:
            try:
                await connection.send_json(message)
            except Exception:
                dead_connections.append(connection)
        for dead in dead_connections:
            active_connections[property_id].remove(dead)

@router.websocket("/ws/pipeline/{property_id}")
async def websocket_endpoint(websocket: WebSocket, property_id: int):
    await websocket.accept()
    if property_id not in active_connections:
        active_connections[property_id] = []
    active_connections[property_id].append(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        active_connections[property_id].remove(websocket)

async def _process_document(doc_id: int, tenant_id: int):
    """Background task: run the full ingestion + agent pipeline for a document."""
    from app.database import async_session

    async with async_session() as db:
        try:
            result = await db.execute(select(Document).where(Document.id == doc_id))
            doc = result.scalar_one_or_none()
            if not doc:
                return

            # Step 1: OCR if not already done
            if not doc.ocr_text:
                logger.info(f"Step 1: Extracting text for doc {doc_id} ({doc.file_type})")
                async with aiofiles.open(doc.file_path, "rb") as f:
                    file_bytes = await f.read()
                
                await notify_clients(doc.property_id, {"document_id": doc_id, "status": "processing", "stage": "ocr"})
                ocr_result = await extract_text_from_file(file_bytes, doc.file_type or "pdf")

                doc.ocr_text = ocr_result["text"]
                doc.ocr_confidence = ocr_result["confidence"]
                doc.ocr_blocks = ocr_result["blocks"]

                # Check confidence threshold for HITL
                threshold = settings.OCR_CONFIDENCE_THRESHOLD
                if ocr_result["confidence"] < threshold and ocr_result["confidence"] > 0:
                    doc.status = DocumentStatus.NEEDS_REVIEW.value
                    await db.commit()
                    logger.info(f"Doc {doc_id}: low confidence ({ocr_result['confidence']}%), flagged for review")
                    await notify_clients(doc.property_id, {"document_id": doc_id, "status": "needs_review", "stage": "low_confidence_ocr"})
                    return

                await db.commit()

            await notify_clients(doc.property_id, {"document_id": doc_id, "status": "processing", "stage": "ai_pipeline"})
            # Step 2: Run agent pipeline
            pipeline_result = await run_pipeline(
                document_id=doc.id,
                property_id=doc.property_id,
                tenant_id=tenant_id,
                raw_text=doc.ocr_text,
                filename=doc.original_filename,
                file_type=doc.file_type or "pdf",
            )

            # Step 3: Update document with AI results
            doc.ai_category = pipeline_result.get("category")
            doc.category = pipeline_result.get("category", doc.category)
            doc.ai_summary = pipeline_result.get("summary", "")
            doc.updated_at = datetime.utcnow()

            if pipeline_result.get("requires_human_review"):
                doc.status = DocumentStatus.NEEDS_REVIEW.value
                await db.commit()
                logger.info(f"Doc {doc_id} pipeline halted for human review")
                await notify_clients(doc.property_id, {"document_id": doc_id, "status": "needs_review", "stage": "human_review"})
                return

            doc.status = DocumentStatus.VERIFIED.value

            # Step 4: Create or update Deal
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

            # Step 5: Index in vector store
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
            await notify_clients(doc.property_id, {"document_id": doc_id, "status": "verified", "stage": "complete"})

        except Exception as e:
            logger.error(f"❌ Pipeline failed for doc {doc_id}: {str(e)}", exc_info=True)
            await db.rollback()
            # Update doc status to failed
            try:
                # We need a fresh session for the error update since the previous one might be in a failed state
                async with async_session() as error_db:
                    result = await error_db.execute(select(Document).where(Document.id == doc_id))
                    error_doc = result.scalar_one_or_none()
                    if error_doc:
                        error_doc.status = DocumentStatus.FAILED.value
                        error_doc.error_message = str(e)
                        await error_db.commit()
                        logger.info(f"Updated status to FAILED for doc {doc_id}")
            except Exception as e2:
                logger.error(f"Failed to update document status to FAILED: {e2}")
            
            # Notify clients of failure
            try:
                # We try to get the property_id from the doc object if it was loaded, 
                # otherwise we might need to fetch it again.
                pid = None
                if 'doc' in locals() and doc:
                    pid = doc.property_id
                else:
                    async with async_session() as fetch_db:
                        res = await fetch_db.execute(select(Document).where(Document.id == doc_id))
                        d = res.scalar_one_or_none()
                        if d: pid = d.property_id
                
                if pid:
                    await notify_clients(pid, {
                        "document_id": doc_id, 
                        "status": "failed", 
                        "stage": "error",
                        "error": str(e)
                    })
            except Exception as e3:
                logger.error(f"Failed to notify clients of error: {e3}")


@router.post("/process/{doc_id}")
async def process_document(
    doc_id: int,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Trigger the AI agent pipeline for a document."""
    result = await db.execute(
        select(Document)
        .join(Property)
        .where(Document.id == doc_id, Property.tenant_id == current_user.tenant_id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    doc.status = DocumentStatus.PROCESSING.value
    await db.commit()

    # Trigger Background Task (instead of Celery to keep it in-process for WebSocket support)
    background_tasks.add_task(_process_document, doc_id, current_user.tenant_id)

    return {"message": "Processing started", "document_id": doc_id, "status": "processing"}


@router.post("/process-all/{property_id}")
async def process_all_documents(
    property_id: int,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Trigger the AI pipeline for ALL pending documents in a property."""
    result = await db.execute(
        select(Property).where(
            Property.id == property_id,
            Property.tenant_id == current_user.tenant_id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Property not found")

    result = await db.execute(
        select(Document).where(
            Document.property_id == property_id,
            Document.status.in_([DocumentStatus.PENDING.value, DocumentStatus.FAILED.value]),
        )
    )
    docs = result.scalars().all()

    for doc in docs:
        doc.status = DocumentStatus.PROCESSING.value
        background_tasks.add_task(_process_document, doc.id, current_user.tenant_id)

    await db.commit()

    return {"message": f"Processing {len(docs)} documents", "property_id": property_id}


@router.get("/status/{doc_id}")
async def get_processing_status(
    doc_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get the current processing status of a document."""
    result = await db.execute(
        select(Document)
        .join(Property)
        .where(Document.id == doc_id, Property.tenant_id == current_user.tenant_id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Check if there's a deal for this document
    deal_result = await db.execute(
        select(Deal).where(Deal.property_id == doc.property_id).order_by(Deal.created_at.desc()).limit(1)
    )
    deal = deal_result.scalar_one_or_none()

    return {
        "document_id": doc.id,
        "status": doc.status,
        "ocr_confidence": doc.ocr_confidence,
        "ai_category": doc.ai_category,
        "has_deal": deal is not None,
        "deal_stage": deal.stage if deal else None,
    }
