"""
Extraction Agent: Pulls financial data and structured fields using OpenAI.
"""
import logging
from app.agents.state import PipelineState
from app.services.structuring import classify_document, extract_deal_data

logger = logging.getLogger(__name__)


async def extraction_agent(state: PipelineState) -> dict:
    """
    Extraction Agent responsibilities:
    1. Classify document using AI
    2. Extract structured deal data
    3. Pass to validation
    """
    logger.info(f"[Extraction] Processing doc {state['document_id']}, iteration {state.get('iterations', 0)}")

    raw_text = state.get("raw_text", "")

    # AI classification
    classification = await classify_document(raw_text)
    category = classification.get("category", state.get("category", "other"))
    subcategory = classification.get("subcategory")

    # AI data extraction
    extracted = await extract_deal_data(raw_text, category)

    return {
        "messages": [("system", f"Extraction: Classified as {category}/{subcategory}. Extracted {len(extracted)} fields.")],
        "category": category,
        "subcategory": subcategory,
        "extracted_data": extracted,
        "stage": "validation",
        "iterations": state.get("iterations", 0) + 1,
    }
