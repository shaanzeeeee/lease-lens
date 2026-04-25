"""
LangGraph agent pipeline state definition.
Shared state flows through all 5 agents in the processing pipeline.
"""
from typing import Annotated, TypedDict, Optional
from langgraph.graph.message import add_messages


class PipelineState(TypedDict):
    """State that flows through the agent pipeline."""
    # LangGraph message accumulator
    messages: Annotated[list, add_messages]

    # Document identifiers
    document_id: int
    property_id: int
    tenant_id: int

    # Raw input
    raw_text: str
    filename: str
    file_type: str

    # Classification
    category: str
    subcategory: Optional[str]

    # Extracted data
    extracted_data: dict
    validation_errors: list

    # Underwriting results
    underwriting_result: dict

    # Final outputs
    report: str
    summary: str

    # Pipeline control
    stage: str  # intake | extraction | validation | underwriting | reporting | complete | human_review
    iterations: int  # Safety counter to prevent infinite loops
    error: Optional[str]
    requires_human_review: bool
