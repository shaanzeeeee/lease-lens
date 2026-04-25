import os
import asyncio
from celery import Celery
from asgiref.sync import async_to_sync

# We'll need the environment setup
from app.config import get_settings
settings = get_settings()

celery_app = Celery(
    "abelam_worker",
    broker=os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0"),
    backend=os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/0"),
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)

@celery_app.task(name="process_document_task")
def process_document_task(doc_id: int, tenant_id: int):
    """
    Celery task to run the full document ingestion and LangGraph pipeline asynchronously.
    """
    from app.routers.agents import _process_document
    
    # Run the full async document processing pipeline synchronously in this Celery worker
    async_to_sync(_process_document)(doc_id, tenant_id)
    
    return {
        "status": "success",
        "document_id": doc_id
    }
