from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import Deal, Property
from app.schemas import DealDetailResponse, PaginatedResponse
from app.auth import get_current_user, User

router = APIRouter(prefix="/api/deals", tags=["Deals"])

@router.get("/", response_model=PaginatedResponse)
async def list_deals(
    property_id: Optional[int] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List deals with filtering by property."""
    query = select(Deal).join(Property).where(Property.tenant_id == current_user.tenant_id)
    if property_id:
        query = query.where(Deal.property_id == property_id)
        
    result = await db.execute(query.offset((page-1)*page_size).limit(page_size))
    deals = result.scalars().all()
    
    # Simple pagination wrapper
    return {
        "items": [DealDetailResponse.model_validate(d) for d in deals],
        "total": len(deals), # Simplified for now
        "page": page,
        "page_size": page_size,
        "total_pages": 1
    }


@router.get("/{deal_id}", response_model=DealDetailResponse)
async def get_deal(
    deal_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get full structured analysis for a specific deal."""
    result = await db.execute(
        select(Deal)
        .join(Property)
        .where(Deal.id == deal_id, Property.tenant_id == current_user.tenant_id)
    )
    deal = result.scalar_one_or_none()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    
    return DealDetailResponse.model_validate(deal)
