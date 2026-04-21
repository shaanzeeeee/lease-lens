"""
Validation Agent: Checks for data consistency and missing values.
Can loop back to extraction if issues are found (max 3 iterations).
"""
import logging
from app.agents.state import PipelineState

logger = logging.getLogger(__name__)

MAX_ITERATIONS = 3


async def validation_agent(state: PipelineState) -> dict:
    """
    Validation Agent responsibilities:
    1. Check extracted data for completeness
    2. Validate financial consistency
    3. Flag missing or suspicious values
    4. Loop back to extraction if fixable, else proceed
    """
    logger.info(f"[Validation] Checking doc {state['document_id']}, iteration {state.get('iterations', 0)}")

    extracted = state.get("extracted_data", {})
    errors = []

    # Check for empty extraction
    if not extracted:
        errors.append("No data was extracted from the document")

    # Validate financials if present
    financials = extracted.get("financials", {})
    if financials:
        # NOI consistency check
        gross_rev = financials.get("gross_revenue")
        op_exp = financials.get("operating_expenses")
        noi = financials.get("noi")

        if gross_rev and op_exp and noi:
            expected_noi = gross_rev - op_exp
            if abs(expected_noi - noi) > 1000:  # Allow $1k tolerance
                errors.append(
                    f"NOI inconsistency: gross_revenue({gross_rev}) - expenses({op_exp}) = {expected_noi}, but NOI is {noi}"
                )

        # Cap rate validation
        cap_rate = financials.get("cap_rate")
        purchase_price = financials.get("purchase_price")
        if cap_rate and noi and purchase_price and purchase_price > 0:
            expected_cap = (noi / purchase_price) * 100
            if abs(expected_cap - cap_rate) > 1:
                errors.append(
                    f"Cap rate inconsistency: NOI/Price = {expected_cap:.2f}%, but cap_rate is {cap_rate}%"
                )

        # Negative value checks
        for field in ["purchase_price", "gross_revenue", "noi"]:
            val = financials.get(field)
            if val is not None and val < 0:
                errors.append(f"Negative value for {field}: {val}")

    # Check lease terms
    lease_terms = extracted.get("lease_terms", [])
    for i, lease in enumerate(lease_terms):
        if isinstance(lease, dict):
            if not lease.get("monthly_rent") and not lease.get("rent"):
                errors.append(f"Lease term {i+1}: missing rent amount")

    # Decision: retry extraction or proceed
    iterations = state.get("iterations", 0)

    if errors and iterations < MAX_ITERATIONS:
        logger.info(f"[Validation] Found {len(errors)} issues, retrying extraction (iter {iterations})")
        return {
            "messages": [("system", f"Validation: Found {len(errors)} issues: {'; '.join(errors[:3])}. Retrying extraction.")],
            "validation_errors": errors,
            "stage": "extraction",  # Loop back
        }

    # Proceed to underwriting (even with errors after max retries)
    if errors:
        logger.warning(f"[Validation] Proceeding with {len(errors)} unresolved issues after {iterations} iterations")

    return {
        "messages": [("system", f"Validation: {'Passed' if not errors else f'{len(errors)} issues accepted'}. Proceeding to underwriting.")],
        "validation_errors": errors,
        "stage": "underwriting",
    }
