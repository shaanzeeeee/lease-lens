"""
AI Structuring service: OpenAI-powered document classification, deal data extraction,
and AI-driven filename suggestion.
"""
import json
import logging
import re
import asyncio
from typing import Optional

from openai import AsyncOpenAI, RateLimitError
from tenacity import retry, wait_exponential, stop_after_attempt, retry_if_exception_type

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# Semaphore to limit concurrent OpenAI API requests
_openai_semaphore = asyncio.Semaphore(3)


def _get_client() -> Optional[AsyncOpenAI]:
    if not settings.OPENAI_API_KEY:
        return None
    return AsyncOpenAI(api_key=settings.OPENAI_API_KEY)


@retry(
    wait=wait_exponential(multiplier=1, min=2, max=10),
    stop=stop_after_attempt(5),
    retry=retry_if_exception_type(RateLimitError),
    before_sleep=lambda retry_state: logger.warning(f"Rate limit hit in classify_document. Retrying in {retry_state.next_action.sleep}s...")
)
async def classify_document(text: str) -> dict:
    """
    Classify a document based on its text content.
    Returns category, subcategory, and confidence.
    """
    client = _get_client()
    if not client or not text.strip():
        return {"category": "other", "subcategory": None, "confidence": 0.0}

    # Optimize token usage: collapse whitespace
    optimized_text = re.sub(r'\s+', ' ', text).strip()

    try:
        async with _openai_semaphore:
            response = await client.chat.completions.create(
                model="gpt-4o",
                messages=[
                {
                    "role": "system",
                    "content": """You are a real estate document classifier.
Classify the document into exactly one category and subcategory.

Categories:
- due_diligence: certificates, location plans, property condition assessments, photos
- lease: lease agreements, renewals, tenant agreements
- expense: insurance, taxes (school, municipal), utilities (hydro, energy), landscaping, snow removal, renovations
- financial: offering memorandums, rent rolls, financial statements, evaluations
- legal: offers, counter offers, notices, conditions fulfillment
- condition: property condition reports, inspection reports
- photo: property photographs, exterior/interior views

Respond in JSON: {"category": "...", "subcategory": "...", "confidence": 0.0-1.0, "reasoning": "..."}"""
                },
                {"role": "user", "content": f"Classify this document:\n\n{optimized_text[:3000]}"}
            ],
            response_format={"type": "json_object"},
            temperature=0.1,
        )

        result = json.loads(response.choices[0].message.content)
        return result
    except Exception as e:
        logger.error(f"Classification failed: {e}")
        return {"category": "other", "subcategory": None, "confidence": 0.0}


@retry(
    wait=wait_exponential(multiplier=1, min=2, max=15),
    stop=stop_after_attempt(5),
    retry=retry_if_exception_type(RateLimitError),
    before_sleep=lambda retry_state: logger.warning(f"Rate limit hit in extract_deal_data. Retrying in {retry_state.next_action.sleep}s...")
)
async def extract_deal_data(text: str, category: str) -> dict:
    """
    Extract structured financial and property data from document text.
    Returns a structured deal data object.
    """
    client = _get_client()
    if not client or not text.strip():
        return {}

    # Optimize token usage: collapse whitespace
    optimized_text = re.sub(r'\s+', ' ', text).strip()

    try:
        async with _openai_semaphore:
            response = await client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {
                    "role": "system",
                    "content": """You are a real estate financial analyst AI.
Extract ALL structured data from this property document.
For financial documents, extract: purchase_price, asking_price, noi, cap_rate, gross_revenue, operating_expenses, cash_on_cash, price_per_unit, grm.
For leases, extract: tenant_name, unit_number, monthly_rent, lease_start, lease_end, lease_terms.
For expenses, extract: expense_type, amount, period, vendor.

Respond in JSON with this structure:
{
  "asset_name": "...",
  "address": "...",
  "financials": {
    "purchase_price": null,
    "asking_price": null,
    "noi": null,
    "cap_rate": null,
    "gross_revenue": null,
    "operating_expenses": null,
    "cash_on_cash": null,
    "price_per_unit": null,
    "grm": null
  },
  "lease_terms": [],
  "expense_items": [],
  "key_findings": [],
  "metadata": {}
}

Use null for missing values. Extract numbers as floats without currency symbols."""
                },
                {"role": "user", "content": f"Document category: {category}\n\nExtract data from:\n\n{optimized_text[:5000]}"}
            ],
            response_format={"type": "json_object"},
            temperature=0.1,
        )

        result = json.loads(response.choices[0].message.content)
        return result
    except Exception as e:
        logger.error(f"Deal extraction failed: {e}")
        return {}


@retry(
    wait=wait_exponential(multiplier=1, min=2, max=10),
    stop=stop_after_attempt(3),
    retry=retry_if_exception_type(RateLimitError),
    before_sleep=lambda retry_state: logger.warning(f"Rate limit hit in generate_deal_summary. Retrying in {retry_state.next_action.sleep}s...")
)
async def generate_deal_summary(structured_data: dict, category: str) -> str:
    """Generate an AI-written executive summary of a deal."""
    client = _get_client()
    if not client:
        return "AI summary unavailable — OpenAI API key not configured."

    try:
        async with _openai_semaphore:
            response = await client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {
                    "role": "system",
                    "content": """You are a senior real estate underwriter writing executive deal summaries.
Write a concise, professional summary (3-5 paragraphs) covering:
1. Property overview and key metrics
2. Financial highlights (NOI, cap rate, revenue)
3. Lease position and tenant quality
4. Risk factors and concerns
5. Investment recommendation

Use precise language and specific numbers from the data."""
                },
                {"role": "user", "content": f"Write a deal summary for this {category} data:\n\n{json.dumps(structured_data, indent=2)[:4000]}"}
            ],
            temperature=0.3,
        )

        return response.choices[0].message.content
    except Exception as e:
        logger.error(f"Summary generation failed: {e}")
        return "Summary generation failed."


async def suggest_filename(
    current_name: str,
    text: str,
    category: str,
    subcategory: str = "",
) -> Optional[str]:
    """
    Use GPT-4o to suggest a descriptive filename for a document.
    Returns None if the current name is already good/descriptive.
    Only renames if the document name is generic (UUID-based, numeric, or uninformative).
    """
    client = _get_client()
    if not client or not text.strip():
        return None

    # Detect if the current filename is already descriptive enough
    # Patterns that indicate a generic/non-descriptive name:
    # - UUID-like strings (hex32)
    # - Just numbers
    # - Completely lowercase with no spaces (common upload artifact)
    name_without_ext = re.sub(r'\.[^.]+$', '', current_name).strip()
    is_uuid_like = bool(re.match(r'^[a-f0-9]{8,}$', name_without_ext, re.IGNORECASE))
    is_numeric = bool(re.match(r'^\d+$', name_without_ext))
    # Consider short names (under 6 chars) or UUID-like names as needing rename
    needs_rename = is_uuid_like or is_numeric or len(name_without_ext) < 5

    if not needs_rename:
        # Name seems descriptive enough — skip AI renaming
        return None

    # Extract file extension to preserve it
    ext_match = re.search(r'(\.[^.]+)$', current_name)
    ext = ext_match.group(1) if ext_match else ""

    # Collapse multiple spaces and optimize token usage
    optimized_text = re.sub(r'\s+', ' ', text).strip()

    try:
        async with _openai_semaphore:
            response = await client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {
                    "role": "system",
                    "content": """You are a real estate document management specialist.

Given a document's content, category, and current filename, suggest a concise, descriptive filename.

Rules:
- Maximum 60 characters (without extension)
- Use Title Case with spaces
- Be specific: include property/tenant/date details if present
- Format: [DocumentType] - [KeyDetail] (e.g. "Lease Agreement - Apt 12 John Smith" or "School Tax Invoice - Q3 2023")
- If the document is already well-named, respond with KEEP_ORIGINAL
- Never include file extensions in your suggestion
- Respond with ONLY the suggested filename or KEEP_ORIGINAL, no explanation"""
                },
                {
                    "role": "user",
                    "content": f"""Current filename: {current_name}
Category: {category}{' / ' + subcategory if subcategory else ''}

Document content (first 1500 chars):
{optimized_text[:1500]}

Suggest a better filename or respond with KEEP_ORIGINAL:"""
                }
            ],
            temperature=0.1,
            max_tokens=80,
        )

        suggestion = response.choices[0].message.content.strip()

        if not suggestion or suggestion == "KEEP_ORIGINAL" or suggestion.upper() == "KEEP_ORIGINAL":
            return None

        # Sanitize: remove any extension the model may have included, then re-add real ext
        suggestion = re.sub(r'\.[a-zA-Z0-9]{2,5}$', '', suggestion).strip()
        # Remove characters unsafe for filenames
        suggestion = re.sub(r'[<>:"/\\|?*]', '', suggestion).strip()
        # Collapse multiple spaces
        suggestion = re.sub(r' +', ' ', suggestion)

        if suggestion:
            return suggestion + ext
        return None

    except Exception as e:
        logger.error(f"Filename suggestion failed: {e}")
        return None
