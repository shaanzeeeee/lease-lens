"""
AI Structuring service: OpenAI-powered document classification and deal data extraction.
"""
import json
import logging
from typing import Optional

from openai import AsyncOpenAI

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


def _get_client() -> Optional[AsyncOpenAI]:
    if not settings.OPENAI_API_KEY:
        return None
    return AsyncOpenAI(api_key=settings.OPENAI_API_KEY)


async def classify_document(text: str) -> dict:
    """
    Classify a document based on its text content.
    Returns category, subcategory, and confidence.
    """
    client = _get_client()
    if not client or not text.strip():
        return {"category": "other", "subcategory": None, "confidence": 0.0}

    try:
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
                {"role": "user", "content": f"Classify this document:\n\n{text[:3000]}"}
            ],
            response_format={"type": "json_object"},
            temperature=0.1,
        )

        result = json.loads(response.choices[0].message.content)
        return result
    except Exception as e:
        logger.error(f"Classification failed: {e}")
        return {"category": "other", "subcategory": None, "confidence": 0.0}


async def extract_deal_data(text: str, category: str) -> dict:
    """
    Extract structured financial and property data from document text.
    Returns a structured deal data object.
    """
    client = _get_client()
    if not client or not text.strip():
        return {}

    try:
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
                {"role": "user", "content": f"Document category: {category}\n\nExtract data from:\n\n{text[:4000]}"}
            ],
            response_format={"type": "json_object"},
            temperature=0.1,
        )

        result = json.loads(response.choices[0].message.content)
        return result
    except Exception as e:
        logger.error(f"Deal extraction failed: {e}")
        return {}


async def generate_deal_summary(structured_data: dict, category: str) -> str:
    """Generate an AI-written executive summary of a deal."""
    client = _get_client()
    if not client:
        return "AI summary unavailable — OpenAI API key not configured."

    try:
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
