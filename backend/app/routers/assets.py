"""
Properties (assets) router: CRUD, search, dashboard stats, and ZIP export.
"""
from typing import Optional
from datetime import datetime
import os
import io
import zipfile

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Property, Document, Deal, Apartment, DocumentStatus, DealStage
from app.schemas import (
    PropertyCreate, PropertyUpdate, PropertyResponse,
    ApartmentCreate, ApartmentResponse,
    PaginatedResponse, DashboardStats, DealResponse,
)
from app.auth import get_current_user, User
from app.services.vectorstore import delete_property_vectors
from app.config import get_settings

settings = get_settings()

router = APIRouter(tags=["Properties"])


@router.get("/dashboard", response_model=DashboardStats)
async def get_dashboard_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Dashboard aggregate statistics for the current tenant."""
    tid = current_user.tenant_id

    # Total properties
    res = await db.execute(
        select(func.count(Property.id)).where(Property.tenant_id == tid)
    )
    total_properties = res.scalar() or 0

    # Total documents
    res = await db.execute(
        select(func.count(Document.id))
        .join(Property)
        .where(Property.tenant_id == tid)
    )
    total_documents = res.scalar() or 0

    # Active deals (not complete)
    res = await db.execute(
        select(func.count(Deal.id))
        .join(Property)
        .where(Property.tenant_id == tid, Deal.stage != DealStage.COMPLETE.value)
    )
    active_deals = res.scalar() or 0

    # Pending verification
    res = await db.execute(
        select(func.count(Document.id))
        .join(Property)
        .where(
            Property.tenant_id == tid,
            Document.status == DocumentStatus.NEEDS_REVIEW.value,
        )
    )
    pending_verification = res.scalar() or 0

    # Total portfolio value
    res = await db.execute(
        select(func.sum(Deal.purchase_price))
        .join(Property)
        .where(Property.tenant_id == tid)
    )
    total_portfolio_value = res.scalar() or 0.0

    # Recent deals
    res = await db.execute(
        select(Deal)
        .join(Property)
        .where(Property.tenant_id == tid)
        .order_by(Deal.created_at.desc())
        .limit(5)
    )
    recent = res.scalars().all()

    return DashboardStats(
        total_properties=total_properties,
        total_documents=total_documents,
        active_deals=active_deals,
        pending_verification=pending_verification,
        total_portfolio_value=total_portfolio_value,
        recent_deals=[DealResponse.model_validate(d) for d in recent],
    )


@router.get("/", response_model=PaginatedResponse)
async def list_properties(
    search: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all properties for the current tenant with search and pagination."""
    tid = current_user.tenant_id

    query = select(Property).where(Property.tenant_id == tid)
    count_query = select(func.count(Property.id)).where(Property.tenant_id == tid)

    if status_filter:
        query = query.where(Property.status == status_filter)
        count_query = count_query.where(Property.status == status_filter)

    if search:
        search_term = f"%{search}%"
        sf = or_(
            Property.name.ilike(search_term),
            Property.address.ilike(search_term),
            Property.city.ilike(search_term),
        )
        query = query.where(sf)
        count_query = count_query.where(sf)

    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    offset = (page - 1) * page_size
    query = query.order_by(Property.created_at.desc()).offset(offset).limit(page_size)

    result = await db.execute(query)
    props = result.scalars().all()

    # Enrich with counts
    items = []
    for p in props:
        pr = PropertyResponse.model_validate(p)
        # Document count
        dc = await db.execute(
            select(func.count(Document.id)).where(Document.property_id == p.id)
        )
        pr.document_count = dc.scalar() or 0
        # Deal count
        dlc = await db.execute(
            select(func.count(Deal.id)).where(Deal.property_id == p.id)
        )
        pr.deal_count = dlc.scalar() or 0
        items.append(pr)

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )


@router.post("/", response_model=PropertyResponse, status_code=201)
async def create_property(
    request: PropertyCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new property asset."""
    prop = Property(
        tenant_id=current_user.tenant_id,
        name=request.name,
        address=request.address,
        city=request.city,
        province_state=request.province_state,
        postal_code=request.postal_code,
        property_type=request.property_type,
        unit_count=request.unit_count,
    )
    db.add(prop)
    await db.flush()
    await db.refresh(prop)
    return PropertyResponse.model_validate(prop)



@router.delete("/{prop_id}", status_code=204)
async def delete_property(
    prop_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a property and all associated data."""
    result = await db.execute(
        select(Property).where(
            Property.id == prop_id,
            Property.tenant_id == current_user.tenant_id,
        )
    )
    prop = result.scalar_one_or_none()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    # 1. Delete vectors from Pinecone
    try:
        await delete_property_vectors(prop_id)
    except Exception as e:
        # Log but don't block deletion if vectorstore is down
        print(f"Warning: Failed to delete vectors for property {prop_id}: {e}")

    # 2. Delete files from disk
    import shutil
    import os
    prop_dir = os.path.join(settings.UPLOAD_DIR, str(prop_id))
    if os.path.exists(prop_dir):
        try:
            shutil.rmtree(prop_dir)
        except Exception as e:
            print(f"Warning: Failed to delete files for property {prop_id}: {e}")

    # 3. Delete from database (cascades handle related documents/deals)
    await db.delete(prop)
    await db.commit()
    return None


@router.get("/{prop_id}", response_model=PropertyResponse)
async def get_property(
    prop_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a single property by ID."""
    result = await db.execute(
        select(Property).where(
            Property.id == prop_id,
            Property.tenant_id == current_user.tenant_id,
        )
    )
    prop = result.scalar_one_or_none()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    pr = PropertyResponse.model_validate(prop)
    dc = await db.execute(
        select(func.count(Document.id)).where(Document.property_id == prop.id)
    )
    pr.document_count = dc.scalar() or 0
    dlc = await db.execute(
        select(func.count(Deal.id)).where(Deal.property_id == prop.id)
    )
    pr.deal_count = dlc.scalar() or 0
    return pr


@router.put("/{prop_id}", response_model=PropertyResponse)
async def update_property(
    prop_id: int,
    request: PropertyUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a property's metadata."""
    result = await db.execute(
        select(Property).where(
            Property.id == prop_id,
            Property.tenant_id == current_user.tenant_id,
        )
    )
    prop = result.scalar_one_or_none()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    update_data = request.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(prop, key, value)
    prop.updated_at = datetime.utcnow()

    await db.flush()
    await db.refresh(prop)
    return PropertyResponse.model_validate(prop)

# ─── Apartments ──────────────────────────────────────────────────────

@router.get("/{prop_id}/apartments", response_model=list[ApartmentResponse])
async def list_apartments(
    prop_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all apartments/units in a property."""
    result = await db.execute(
        select(Property).where(
            Property.id == prop_id,
            Property.tenant_id == current_user.tenant_id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Property not found")

    result = await db.execute(
        select(Apartment)
        .where(Apartment.property_id == prop_id)
        .order_by(Apartment.unit_number)
    )
    apartments = result.scalars().all()
    return [ApartmentResponse.model_validate(a) for a in apartments]


@router.post("/{prop_id}/apartments", response_model=ApartmentResponse, status_code=201)
async def create_apartment(
    prop_id: int,
    request: ApartmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add an apartment unit to a property."""
    result = await db.execute(
        select(Property).where(
            Property.id == prop_id,
            Property.tenant_id == current_user.tenant_id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Property not found")

    apt = Apartment(
        property_id=prop_id,
        unit_number=request.unit_number,
        unit_type=request.unit_type,
        floor=request.floor,
        bedrooms=request.bedrooms,
        bathrooms=request.bathrooms,
        square_feet=request.square_feet,
        monthly_rent=request.monthly_rent,
        tenant_name=request.tenant_name,
        status=request.status,
    )
    db.add(apt)
    await db.flush()
    await db.refresh(apt)
    return ApartmentResponse.model_validate(apt)


@router.get("/{prop_id}/summary")
async def get_property_summary(
    prop_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get an aggregated AI summary for the property based on all documents."""
    result = await db.execute(
        select(Property).where(
            Property.id == prop_id,
            Property.tenant_id == current_user.tenant_id,
        )
    )
    prop = result.scalar_one_or_none()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    # Get all document summaries
    result = await db.execute(
        select(Document.ai_summary).where(
            Document.property_id == prop_id,
            Document.ai_summary != None,
            Document.ai_summary != ""
        )
    )
    summaries = result.scalars().all()

    # Get latest deal info
    result = await db.execute(
        select(Deal).where(Deal.property_id == prop_id).order_by(Deal.created_at.desc()).limit(1)
    )
    deal = result.scalar_one_or_none()

    combined_summary = "\n\n".join(summaries) if summaries else "No document summaries available."
    
    return {
        "property_name": prop.name,
        "combined_summary": combined_summary,
        "deal_metrics": {
            "noi": deal.noi if deal else None,
            "cap_rate": deal.cap_rate if deal else None,
            "purchase_price": deal.purchase_price if deal else None,
            "cash_on_cash": deal.cash_on_cash if deal else None,
        } if deal else None,
        "document_count": len(summaries)
    }


@router.get("/{prop_id}/export-zip")
async def export_property_zip(
    prop_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Stream all documents for a property as a single ZIP file.
    Files are organized by category/subcategory matching the UI folder structure.
    """
    result = await db.execute(
        select(Property).where(
            Property.id == prop_id,
            Property.tenant_id == current_user.tenant_id,
        )
    )
    prop = result.scalar_one_or_none()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    # Fetch all documents for the property
    docs_result = await db.execute(
        select(Document).where(Document.property_id == prop_id)
    )
    docs = docs_result.scalars().all()

    if not docs:
        raise HTTPException(status_code=404, detail="No documents found for this property")

    # Build ZIP in memory
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        seen_names: dict[str, int] = {}  # track duplicate names within same folder

        for doc in docs:
            if not os.path.exists(doc.file_path):
                continue

            # Build folder path matching UI structure: category/subcategory/
            category = doc.category or "Uncategorized"
            parts = [category]
            if doc.subcategory:
                parts.append(doc.subcategory)

            folder_path = "/".join(parts)
            display_name = doc.original_filename or doc.filename

            # Deduplicate filenames within the same folder
            key = f"{folder_path}/{display_name}"
            if key in seen_names:
                seen_names[key] += 1
                name_stem, ext = os.path.splitext(display_name)
                display_name = f"{name_stem} ({seen_names[key]}){ext}"
            else:
                seen_names[key] = 0

            arcname = f"{folder_path}/{display_name}"

            try:
                zf.write(doc.file_path, arcname=arcname)
            except Exception as e:
                # Skip unreadable files but continue
                import logging
                logging.getLogger(__name__).warning(f"Skipping doc {doc.id} in ZIP: {e}")

    zip_buffer.seek(0)

    # Sanitise property name for filename
    safe_name = "".join(c if c.isalnum() or c in " -_" else "_" for c in prop.name).strip()
    zip_filename = f"{safe_name}_Documents.zip"

    return StreamingResponse(
        iter([zip_buffer.read()]),
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="{zip_filename}"',
            "Content-Type": "application/zip",
        },
    )
