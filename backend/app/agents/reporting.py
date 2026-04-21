"""
Reporting Agent: Generates AI-written deal summaries.
Final node in the LangGraph pipeline.
"""
import logging
from app.agents.state import PipelineState
from app.services.structuring import generate_deal_summary

logger = logging.getLogger(__name__)


async def reporting_agent(state: PipelineState) -> dict:
    """
    Reporting Agent responsibilities:
    1. Compile all extracted data and underwriting results
    2. Generate an AI-written executive deal summary
    3. Finalize the pipeline
    """
    logger.info(f"[Reporting] Generating report for doc {state['document_id']}")

    extracted = state.get("extracted_data", {})
    underwriting = state.get("underwriting_result", {})

    # Merge data for summary generation
    combined_data = {
        **extracted,
        "underwriting_metrics": underwriting,
        "category": state.get("category", "other"),
        "filename": state.get("filename", ""),
        "validation_errors": state.get("validation_errors", []),
    }

    # Generate AI summary
    summary = await generate_deal_summary(combined_data, state.get("category", "other"))

    # Build final report
    report_parts = [
        f"# Deal Analysis Report",
        f"**Document**: {state.get('filename', 'Unknown')}",
        f"**Category**: {state.get('category', 'N/A')} / {state.get('subcategory', 'N/A')}",
        f"",
        f"## Executive Summary",
        summary,
        f"",
        f"## Key Metrics",
    ]

    # Add underwriting metrics
    for key, value in underwriting.items():
        if key not in ("risks", "deal_score") and value is not None:
            label = key.replace("_", " ").title()
            if isinstance(value, float):
                if "rate" in key or "ratio" in key or "cash_on_cash" in key:
                    report_parts.append(f"- **{label}**: {value:.2f}%")
                else:
                    report_parts.append(f"- **{label}**: ${value:,.2f}")
            else:
                report_parts.append(f"- **{label}**: {value}")

    # Add deal score
    deal_score = underwriting.get("deal_score")
    if deal_score is not None:
        report_parts.extend([f"", f"## Deal Score: {deal_score}/100"])

    # Add risks
    risks = underwriting.get("risks", [])
    if risks:
        report_parts.extend([f"", f"## Risk Factors"])
        for risk in risks:
            report_parts.append(f"- ⚠️ {risk}")

    report = "\n".join(report_parts)

    return {
        "messages": [("system", f"Reporting: Generated {len(report)} char report. Pipeline complete.")],
        "report": report,
        "summary": summary,
        "stage": "complete",
    }
