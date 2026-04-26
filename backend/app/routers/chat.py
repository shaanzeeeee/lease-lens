"""
Chat router: RAG chatbot endpoint with conversation history.
"""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import ChatMessage, Property
from app.schemas import ChatRequest, ChatResponse, ChatHistoryResponse
from app.auth import get_current_user, User
from app.services.rag import chat_with_rag

router = APIRouter(prefix="/api/chat", tags=["RAG Chat"])


@router.post("/", response_model=ChatResponse)
async def send_message(
    request: ChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Send a chat message and receive an AI response with source citations."""
    # Get recent conversation history (strictly isolated by property)
    query = select(ChatMessage).where(
        ChatMessage.user_id == current_user.id,
        ChatMessage.property_id == request.property_id
    )
    
    history_result = await db.execute(
        query.order_by(ChatMessage.created_at.desc()).limit(6)
    )
    history_msgs = history_result.scalars().all()
    history = [
        {"message": m.message, "response": m.response}
        for m in reversed(history_msgs)
    ]

    # Get Property Name for anchoring context
    property_name = None
    if request.property_id:
        p_res = await db.execute(select(Property.name).where(Property.id == request.property_id))
        property_name = p_res.scalar()

    # Get RAG response
    rag_result = await chat_with_rag(
        query=request.message,
        tenant_id=current_user.tenant_id,
        property_id=request.property_id,
        property_name=property_name,
        history=history,
    )

    # Save to database
    chat_msg = ChatMessage(
        user_id=current_user.id,
        property_id=request.property_id,
        message=request.message,
        response=rag_result["answer"],
        sources=rag_result["sources"],
    )
    db.add(chat_msg)
    await db.flush()
    await db.refresh(chat_msg)

    return ChatResponse(
        message=chat_msg.message,
        response=chat_msg.response,
        sources=rag_result["sources"],
        created_at=chat_msg.created_at,
    )


@router.get("/history", response_model=ChatHistoryResponse)
async def get_history(
    property_id: Optional[int] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get chat conversation history."""
    query = select(ChatMessage).where(ChatMessage.user_id == current_user.id)
    count_query = select(func.count(ChatMessage.id)).where(ChatMessage.user_id == current_user.id)

    # Strictly isolated by property
    query = query.where(ChatMessage.property_id == property_id)
    count_query = count_query.where(ChatMessage.property_id == property_id)

    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    offset = (page - 1) * page_size
    query = query.order_by(ChatMessage.created_at.desc()).offset(offset).limit(page_size)

    result = await db.execute(query)
    messages = result.scalars().all()

    return ChatHistoryResponse(
        messages=[
            ChatResponse(
                message=m.message,
                response=m.response,
                sources=m.sources or [],
                created_at=m.created_at,
            )
            for m in reversed(messages)
        ],
        total=total,
    )
