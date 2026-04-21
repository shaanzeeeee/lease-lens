"""
Properties (assets) router: CRUD, search, dashboard stats.
"""
from typing import Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
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

router = APIRouter(prefix="/api/properties", tags=["Properties"])


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
