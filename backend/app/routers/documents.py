"""
Document router: upload, list, get, verify (HITL), and serve files.
"""
import os
import uuid
import shutil
from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query, status
from fastapi.responses import FileResponse
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import Document, Property, DocumentStatus
from app.schemas import (
    DocumentResponse, DocumentDetailResponse, DocumentVerifyRequest,
    PaginatedResponse,
)
from app.auth import get_current_user, User
from app.config import get_settings

settings = get_settings()
router = APIRouter(prefix="/api/documents", tags=["Documents"])


@router.post("/upload", response_model=List[DocumentResponse])
async def upload_documents(
    property_id: int = Form(...),
    category: str = Form("other"),
    subcategory: Optional[str] = Form(None),
    apartment_id: Optional[int] = Form(None),
    files: List[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload one or more documents to a property."""
    # Verify property belongs to user's tenant
    result = await db.execute(
        select(Property).where(
            Property.id == property_id,
            Property.tenant_id == current_user.tenant_id,
        )
    )
    prop = result.scalar_one_or_none()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    uploaded = []
    for file in files:
        # Generate unique filename
        ext = os.path.splitext(file.filename)[1].lower()
        unique_name = f"{uuid.uuid4().hex}{ext}"
        file_path = os.path.join(settings.UPLOAD_DIR, str(property_id), unique_name)

        # Create directory
        os.makedirs(os.path.dirname(file_path), exist_ok=True)

        # Save file
        with open(file_path, "wb") as buf:
            shutil.copyfileobj(file.file, buf)

        # Determine file type
        file_type = ext.lstrip(".")
        if file_type in ("jpg", "jpeg"):
            file_type = "jpg"

        # Get file size
        file_size = os.path.getsize(file_path)

        doc = Document(
            property_id=property_id,
            apartment_id=apartment_id,
            filename=unique_name,
            original_filename=file.filename,
            file_path=file_path,
            file_type=file_type,
            file_size=file_size,
            category=category,
            subcategory=subcategory,
            status=DocumentStatus.PENDING.value,
        )
        db.add(doc)
        await db.flush()
        await db.refresh(doc)
        uploaded.append(DocumentResponse.model_validate(doc))

    await db.commit()
    return uploaded


@router.get("/", response_model=PaginatedResponse)
async def list_documents(
    property_id: Optional[int] = Query(None),
    category: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List documents with filtering and pagination."""
    query = (
        select(Document)
        .options(selectinload(Document.deals))
        .join(Property)
        .where(Property.tenant_id == current_user.tenant_id)
    )
    count_query = (
        select(func.count(Document.id))
        .join(Property)
        .where(Property.tenant_id == current_user.tenant_id)
    )

    if property_id:
        query = query.where(Document.property_id == property_id)
        count_query = count_query.where(Document.property_id == property_id)
    if category:
        query = query.where(Document.category == category)
        count_query = count_query.where(Document.category == category)
    if status_filter:
        query = query.where(Document.status == status_filter)
        count_query = count_query.where(Document.status == status_filter)
    if search:
        search_term = f"%{search}%"
        search_filter = or_(
            Document.original_filename.ilike(search_term),
            Document.ai_summary.ilike(search_term),
            Document.subcategory.ilike(search_term),
        )
        query = query.where(search_filter)
        count_query = count_query.where(search_filter)

    # Count total
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Paginate
    offset = (page - 1) * page_size
    query = query.order_by(Document.created_at.desc()).offset(offset).limit(page_size)

    result = await db.execute(query)
    docs = result.scalars().all()

    return PaginatedResponse(
        items=[DocumentResponse.model_validate(d) for d in docs],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )


@router.get("/{doc_id}", response_model=DocumentDetailResponse)
async def get_document(
    doc_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get full document details including OCR text."""
    result = await db.execute(
        select(Document)
        .options(selectinload(Document.deals))
        .join(Property)
        .where(Document.id == doc_id, Property.tenant_id == current_user.tenant_id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return DocumentDetailResponse.model_validate(doc)


@router.get("/{doc_id}/file")
async def serve_document_file(
    doc_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Serve the original uploaded file."""
    result = await db.execute(
        select(Document)
        .join(Property)
        .where(Document.id == doc_id, Property.tenant_id == current_user.tenant_id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if not os.path.exists(doc.file_path):
        raise HTTPException(status_code=404, detail="File not found on disk")

    media_type_map = {
        "pdf": "application/pdf",
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "png": "image/png",
        "tiff": "image/tiff",
        "tif": "image/tiff",
    }
    media_type = media_type_map.get(doc.file_type, "application/octet-stream")

    return FileResponse(
        doc.file_path,
        media_type=media_type,
        filename=doc.original_filename,
    )


@router.put("/{doc_id}/verify", response_model=DocumentDetailResponse)
async def verify_document(
    doc_id: int,
    request: DocumentVerifyRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """HITL: Admin corrects OCR text for a flagged document."""
    result = await db.execute(
        select(Document)
        .join(Property)
        .where(Document.id == doc_id, Property.tenant_id == current_user.tenant_id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    doc.ocr_text = request.corrected_text
    doc.status = DocumentStatus.VERIFIED.value
    doc.ocr_confidence = 100.0  # Human-verified
    doc.updated_at = datetime.utcnow()

    await db.flush()
    await db.refresh(doc)
    return DocumentDetailResponse.model_validate(doc)


@router.put("/{doc_id}/approve", response_model=DocumentResponse)
async def approve_document(
    doc_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Approve a document that was pending review."""
    result = await db.execute(
        select(Document)
        .join(Property)
        .where(Document.id == doc_id, Property.tenant_id == current_user.tenant_id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    doc.status = DocumentStatus.VERIFIED.value
    doc.updated_at = datetime.utcnow()
    await db.flush()
    await db.refresh(doc)
    
    # Notify clients via WebSocket
    from app.routers.agents import notify_clients
    await notify_clients(doc.property_id, {"document_id": doc.id, "status": "verified", "stage": "manual_approval"})
    
    return DocumentResponse.model_validate(doc)


@router.delete("/{doc_id}", status_code=204)
async def delete_document(
    doc_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a document and its file."""
    result = await db.execute(
        select(Document)
        .join(Property)
        .where(Document.id == doc_id, Property.tenant_id == current_user.tenant_id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Delete from disk
    if os.path.exists(doc.file_path):
        try:
            os.remove(doc.file_path)
        except Exception as e:
            print(f"Warning: Failed to delete file {doc.file_path}: {e}")

    await db.delete(doc)
    await db.commit()
    return None
