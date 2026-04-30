"""
Agents router: Trigger and monitor the LangGraph document processing pipeline.
The core pipeline logic lives in services/pipeline.py to avoid circular imports.
"""
import logging

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Document, Deal, Property, DocumentStatus
from app.auth import get_current_user, User
from app.services.pipeline import process_document_background

logger = logging.getLogger(__name__)
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
        if websocket in active_connections.get(property_id, []):
            active_connections[property_id].remove(websocket)


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

    background_tasks.add_task(process_document_background, doc_id, current_user.tenant_id)

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
        background_tasks.add_task(process_document_background, doc.id, current_user.tenant_id)

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
