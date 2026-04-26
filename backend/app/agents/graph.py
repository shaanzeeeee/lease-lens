"""
LangGraph StateGraph: Orchestrates the 5-agent document processing pipeline.

Pipeline flow:
  START → intake → extraction → validation → underwriting → reporting → END
                       ↑              |
                       └── (retry) ───┘
"""
import logging
import traceback
from langgraph.graph import StateGraph, START, END

from app.agents.state import PipelineState
from app.agents.intake import intake_agent
from app.agents.extraction import extraction_agent
from app.agents.validation import validation_agent
from app.agents.underwriting import underwriting_agent
from app.agents.reporting import reporting_agent

logger = logging.getLogger(__name__)


def _route_after_validation(state: PipelineState) -> str:
    """Route after validation: retry extraction, pause for HITL, or proceed to underwriting."""
    stage = state.get("stage", "underwriting")
    iterations = state.get("iterations", 0)
    requires_human_review = state.get("requires_human_review", False)

    if requires_human_review:
        # Pause pipeline for Human-In-The-Loop
        logger.info(f"[Graph] Routing to END for human review (doc {state['document_id']})")
        return END

    if stage == "extraction" and iterations < 3:
        return "extraction"
    return "underwriting"


def _route_after_intake(state: PipelineState) -> str:
    """Route after intake: if error, skip to END."""
    if state.get("error"):
        return END
    return "extraction"


def build_pipeline() -> StateGraph:
    """Build and compile the LangGraph agent pipeline."""
    graph = StateGraph(PipelineState)

    # Add nodes
    graph.add_node("intake", intake_agent)
    graph.add_node("extraction", extraction_agent)
    graph.add_node("validation", validation_agent)
    graph.add_node("underwriting", underwriting_agent)
    graph.add_node("reporting", reporting_agent)

    # Add edges
    graph.add_edge(START, "intake")
    graph.add_conditional_edges("intake", _route_after_intake, ["extraction", END])
    graph.add_edge("extraction", "validation")
    graph.add_conditional_edges("validation", _route_after_validation, ["extraction", "underwriting", END])
    graph.add_edge("underwriting", "reporting")
    graph.add_edge("reporting", END)

    return graph.compile()


# Compiled pipeline instance
pipeline = build_pipeline()


async def run_pipeline(
    document_id: int,
    property_id: int,
    tenant_id: int,
    raw_text: str,
    filename: str,
    file_type: str,
) -> dict:
    """
    Execute the full agent pipeline for a document.
    Returns the final state with all extracted data, metrics, and report.
    """
    initial_state = {
        "messages": [],
        "document_id": document_id,
        "property_id": property_id,
        "tenant_id": tenant_id,
        "raw_text": raw_text,
        "filename": filename,
        "file_type": file_type,
        "category": "other",
        "subcategory": None,
        "extracted_data": {},
        "validation_errors": [],
        "underwriting_result": {},
        "report": "",
        "summary": "",
        "stage": "intake",
        "iterations": 0,
        "error": None,
        "requires_human_review": False,
    }

    try:
        result = await pipeline.ainvoke(initial_state)
        logger.info(f"Pipeline complete for doc {document_id}: stage={result.get('stage')}")
        return result
    except Exception as e:
        logger.error(f"Pipeline failed for doc {document_id}: {e}")
        logger.error(traceback.format_exc())
        return {
            **initial_state,
            "stage": "complete",
            "error": str(e),
        }
