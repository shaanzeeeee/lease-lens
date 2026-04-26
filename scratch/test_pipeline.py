
import asyncio
import os
import sys

# Set DATABASE_URL BEFORE importing app
abs_path = os.path.abspath("backend/test.db")
os.environ["DATABASE_URL"] = f"sqlite:///{abs_path}"

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), "backend"))

from app.agents.graph import run_pipeline
from app.database import async_session
from app.models import Document

async def test_pipeline():
    async with async_session() as db:
        # Get the first failed document
        from sqlalchemy import select
        from app.models import DocumentStatus
        
        stmt = select(Document).where(Document.id == 16)
        result = await db.execute(stmt)
        doc = result.scalar_one_or_none()
        
        if not doc:
            print("Document ID 2 not found")
            return
        
        print(f"Testing pipeline for {doc.filename}")
        
        # Manually trigger pipeline
        try:
            result = await run_pipeline(
                document_id=doc.id,
                property_id=doc.property_id,
                tenant_id=1,
                raw_text=doc.ocr_text,
                filename=doc.filename,
                file_type=doc.file_type
            )
            print("Pipeline result:", result.get("stage"))
            if result.get("error"):
                print("Pipeline Error:", result.get("error"))
        except Exception as e:
            print("Pipeline exception:", str(e))

if __name__ == "__main__":
    asyncio.run(test_pipeline())
