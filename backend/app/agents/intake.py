"""
Intake Agent: Routes and logs incoming files.
First node in the LangGraph pipeline.
"""
import logging
from app.agents.state import PipelineState

logger = logging.getLogger(__name__)


async def intake_agent(state: PipelineState) -> dict:
    """
    Intake Agent responsibilities:
    1. Log the incoming document
    2. Validate file type and content
    3. Route to extraction
    """
    logger.info(f"[Intake] Processing doc {state['document_id']}: {state['filename']}")

    # Validate we have text to work with
    raw_text = state.get("raw_text", "")
    if not raw_text or len(raw_text.strip()) < 10:
        return {
            "messages": [("system", f"Intake: Document {state['filename']} has insufficient text ({len(raw_text)} chars). Flagging for review.")],
            "stage": "complete",
            "error": "Insufficient text extracted from document",
        }

    # Determine initial category based on filename patterns
    filename_lower = state.get("filename", "").lower()
    initial_category = "other"

    category_patterns = {
        "lease": ["lease", "bail", "renewal", "renouvellement"],
        "expense": ["expense", "tax", "hydro", "insurance", "landscaping", "snow", "municipal", "school"],
        "financial": ["evaluation", "fonciere", "rent_roll", "financial", "revenue"],
        "legal": ["offer", "counter", "notice", "fulfilment", "condition", "certificate"],
        "condition": ["pca", "inspection", "condition"],
        "photo": ["photo", "view", "facade", "interior", "entrance", "parking", "screenshot"],
    }

    for cat, patterns in category_patterns.items():
        if any(p in filename_lower for p in patterns):
            initial_category = cat
            break

    return {
        "messages": [("system", f"Intake: Accepted {state['filename']} ({len(raw_text)} chars). Initial category: {initial_category}")],
        "category": initial_category,
        "stage": "extraction",
        "iterations": 0,
    }
