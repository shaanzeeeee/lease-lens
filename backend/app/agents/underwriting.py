"""
Underwriting Agent: Financial calculations and deal analysis.
"""
import logging
from app.agents.state import PipelineState

logger = logging.getLogger(__name__)


async def underwriting_agent(state: PipelineState) -> dict:
    """
    Underwriting Agent responsibilities:
    1. Calculate derived financial metrics
    2. Score the deal quality
    3. Flag risk factors
    """
    logger.info(f"[Underwriting] Analyzing doc {state['document_id']}")

    extracted = state.get("extracted_data", {})
    financials = extracted.get("financials", {})
    result = {}

    # Extract base numbers
    purchase_price = financials.get("purchase_price") or financials.get("asking_price")
    gross_revenue = financials.get("gross_revenue")
    operating_expenses = financials.get("operating_expenses")
    noi = financials.get("noi")
    lease_terms = extracted.get("lease_terms", [])

    # Calculate NOI if missing
    if not noi and gross_revenue and operating_expenses:
        noi = gross_revenue - operating_expenses
        result["noi"] = noi

    # Cap Rate
    if noi and purchase_price and purchase_price > 0:
        result["cap_rate"] = round((noi / purchase_price) * 100, 2)

    # Gross Rent Multiplier
    if gross_revenue and purchase_price and gross_revenue > 0:
        result["grm"] = round(purchase_price / gross_revenue, 2)

    # Price per unit
    unit_count = len(lease_terms) if lease_terms else extracted.get("unit_count")
    if unit_count and purchase_price:
        result["price_per_unit"] = round(purchase_price / unit_count, 2)

    # Expense ratio
    if operating_expenses and gross_revenue and gross_revenue > 0:
        result["expense_ratio"] = round((operating_expenses / gross_revenue) * 100, 2)

    # Cash-on-Cash (simplified: assume 75% LTV, 5% interest, 25yr amortization)
    if noi and purchase_price:
        down_payment = purchase_price * 0.25
        if down_payment > 0:
            # Simplified annual debt service estimate
            loan_amount = purchase_price * 0.75
            annual_debt_service = loan_amount * 0.065  # ~6.5% constant
            cash_flow = noi - annual_debt_service
            result["cash_on_cash"] = round((cash_flow / down_payment) * 100, 2)

    # Risk scoring
    risks = []
    if result.get("cap_rate") and result["cap_rate"] < 4:
        risks.append("Low cap rate — potentially overpriced")
    if result.get("cap_rate") and result["cap_rate"] > 10:
        risks.append("High cap rate — may indicate higher risk")
    if result.get("expense_ratio") and result["expense_ratio"] > 55:
        risks.append("High expense ratio (>55%) — operating costs concern")
    if result.get("cash_on_cash") and result["cash_on_cash"] < 0:
        risks.append("Negative cash-on-cash — deal may not cash flow")
    if not lease_terms:
        risks.append("No lease data found — tenant stability unknown")

    result["risks"] = risks
    result["deal_score"] = _calculate_deal_score(result)

    return {
        "messages": [("system", f"Underwriting: Calculated {len(result)} metrics. Deal score: {result.get('deal_score', 'N/A')}/100")],
        "underwriting_result": result,
        "stage": "reporting",
    }


def _calculate_deal_score(metrics: dict) -> int:
    """Simple deal quality score (0-100)."""
    score = 50  # Base score

    cap_rate = metrics.get("cap_rate")
    if cap_rate:
        if 5 <= cap_rate <= 8:
            score += 15
        elif 4 <= cap_rate < 5 or 8 < cap_rate <= 10:
            score += 8
        else:
            score -= 5

    coc = metrics.get("cash_on_cash")
    if coc:
        if coc > 10:
            score += 20
        elif coc > 5:
            score += 12
        elif coc > 0:
            score += 5
        else:
            score -= 10

    expense_ratio = metrics.get("expense_ratio")
    if expense_ratio:
        if expense_ratio < 40:
            score += 10
        elif expense_ratio < 50:
            score += 5
        else:
            score -= 5

    # Deduct for risks
    risks = metrics.get("risks", [])
    score -= len(risks) * 3

    return max(0, min(100, score))
