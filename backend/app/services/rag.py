"""
RAG (Retrieval-Augmented Generation) chat service.
Combines vector search with LLM for source-cited responses.
Detects apartment-specific queries and injects structured DB context.
"""
import json
import logging
import re
from typing import Optional, List, Tuple

from openai import OpenAI
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.services.vectorstore import search_vectors

logger = logging.getLogger(__name__)
settings = get_settings()


def _get_client() -> Optional[OpenAI]:
    if not settings.OPENAI_API_KEY:
        return None
    return OpenAI(api_key=settings.OPENAI_API_KEY)


def _detect_apartment_query(query: str) -> Optional[str]:
    """
    Detect if the user is asking about a specific apartment/unit.
    Returns the unit identifier if found, else None.
    """
    query_lower = query.lower()

    # Patterns: "apartment 3", "apt 101", "unit 5B", "apt. 31", "#12", etc.
    patterns = [
        r'(?:apartment|apt\.?|unit|suite|ste\.?)\s*#?\s*([a-z0-9-]+)',
        r'#\s*(\d+[a-z]?)',
        r'(?:tell me about|details (?:of|for|on)|info (?:on|about|for)|show me)\s+(?:apartment|apt\.?|unit)?\s*#?\s*([a-z0-9-]+)',
    ]

    for pattern in patterns:
        match = re.search(pattern, query_lower)
        if match:
            return match.group(1).strip()

    return None


async def _get_apartment_context(
    unit_identifier: str,
    property_id: int,
    db: AsyncSession,
) -> Tuple[Optional[str], List[int]]:
    """
    Fetch structured apartment data from the database and format it
    as rich context for the LLM.
    Falls back to document-based matching if no apartment records exist.
    """
    from app.models import Apartment, Document, Deal, Property
    import datetime as dt

    # Find the apartment by matching unit_number
    result = await db.execute(
        select(Apartment).where(
            Apartment.property_id == property_id,
        )
    )
    apartments = result.scalars().all()

    # Fuzzy match: strip punctuation and compare
    target = unit_identifier.lower().replace(".", "").replace(" ", "").replace("_", "").replace("#", "")
    matched_apt = None
    for apt in apartments:
        normalized = apt.unit_number.lower().replace(".", "").replace(" ", "").replace("_", "").replace("#", "")
        if target == normalized or target in normalized or normalized in target:
            matched_apt = apt
            break

    # Fetch ALL documents for this property
    docs_result = await db.execute(
        select(Document).where(Document.property_id == property_id)
    )
    all_docs = docs_result.scalars().all()

    # Match documents to this unit
    linked_docs = []
    # Build multiple search variants for the unit identifier
    search_variants = [
        unit_identifier.lower(),
        f"apt. {unit_identifier}".lower(),
        f"apt.{unit_identifier}".lower(),
        f"apt {unit_identifier}".lower(),
        f"apartment {unit_identifier}".lower(),
        f"unit {unit_identifier}".lower(),
        f"apt_{unit_identifier}".lower(),
        f"apt. {unit_identifier}_".lower(),
    ]

    for doc in all_docs:
        already_linked = False
        # Check explicit apartment_id link
        if matched_apt and doc.apartment_id == matched_apt.id:
            linked_docs.append(doc)
            already_linked = True

        if not already_linked:
            # Check filename, subcategory, relative_path for unit mentions
            fields_to_check = [
                doc.original_filename or "",
                doc.subcategory or "",
                doc.relative_path or "",
            ]
            for field in fields_to_check:
                field_lower = field.lower()
                for variant in search_variants:
                    if variant in field_lower:
                        # Find all occurrences
                        start_search = 0
                        while True:
                            idx = field_lower.find(variant, start_search)
                            if idx == -1:
                                break
                            
                            # Check preceding char (if it exists and is a digit)
                            preceding_digit = False
                            if idx > 0:
                                if field_lower[idx-1].isdigit():
                                    preceding_digit = True
                            
                            # Check following char (if it exists and is a digit)
                            following_digit = False
                            end_idx = idx + len(variant)
                            if end_idx < len(field_lower):
                                if field_lower[end_idx].isdigit():
                                    following_digit = True
                            
                            # Valid match if not surrounded by digits
                            if not preceding_digit and not following_digit:
                                linked_docs.append(doc)
                                already_linked = True
                                break
                            
                            start_search = idx + 1
                        
                        if already_linked:
                            break
                if already_linked:
                    break

    # Fetch deals from those documents
    doc_ids = [d.id for d in linked_docs]
    linked_deals = []
    if doc_ids:
        deals_result = await db.execute(
            select(Deal).where(Deal.document_id.in_(doc_ids))
        )
        linked_deals = list(deals_result.scalars().all())

    # If we have no apartment record and no documents, return None
    if not matched_apt and not linked_docs:
        return None, []

    # Build structured text
    lines = []
    lines.append(f"=== APARTMENT UNIT INTELLIGENCE REPORT: Unit {unit_identifier} ===")

    if matched_apt:
        lines.append(f"Unit Type: {matched_apt.unit_type or 'Unknown'}")
        lines.append(f"Floor: {matched_apt.floor or 'Unknown'}")
        lines.append(f"Bedrooms: {matched_apt.bedrooms or '?'}")
        lines.append(f"Bathrooms: {matched_apt.bathrooms or '?'}")
        lines.append(f"Square Footage: {matched_apt.square_feet or 'Unknown'} sq ft")
        lines.append(f"Current Status: {matched_apt.status or 'Unknown'}")
        
        if matched_apt.monthly_rent:
            lines.append(f"Monthly Rent: ${matched_apt.monthly_rent:,.2f}")
            lines.append(f"Annual Rent: ${matched_apt.monthly_rent * 12:,.2f}")
        
        if matched_apt.lease_start and matched_apt.lease_end:
            lines.append(f"Lease Term: {matched_apt.lease_start.strftime('%Y-%m-%d')} to {matched_apt.lease_end.strftime('%Y-%m-%d')}")
            now = dt.datetime.utcnow()
            delta = matched_apt.lease_end - now
            days_remaining = delta.days
            if days_remaining < 0:
                lines.append(f"Lease Status: ⚠️ EXPIRED")
            elif days_remaining < 90:
                lines.append(f"Lease Status: ⏳ Expiring Soon ({days_remaining} days)")
            else:
                lines.append(f"Lease Status: ✅ Active ({days_remaining} days remaining)")
        else:
            lines.append(f"Lease Status: Unknown (no end date recorded)")
    else:
        lines.append(f"NOTE: No apartment record found in database. Information below is derived from uploaded documents only.")
        lines.append(f"The property manager should add structured apartment data for richer reports.")

    lines.append(f"")
    lines.append(f"--- LINKED DOCUMENTS ({len(linked_docs)} total) ---")
    for doc in linked_docs[:15]:
        status_icon = "✅" if doc.status == "verified" else "⏳" if doc.status == "processing" else "📄"
        category_label = doc.category or "uncategorized"
        lines.append(f"  {status_icon} {doc.original_filename} [{category_label}] - {doc.status}")
        if doc.ai_summary:
            lines.append(f"     AI Summary: {doc.ai_summary[:300]}")
    if len(linked_docs) > 15:
        lines.append(f"  ... and {len(linked_docs) - 15} more documents")

    if linked_deals:
        lines.append(f"")
        lines.append(f"--- DEAL METRICS ({len(linked_deals)} deals) ---")
        for deal in linked_deals:
            lines.append(f"  Deal: {deal.deal_name} (Stage: {deal.stage})")
            if deal.noi:
                lines.append(f"    NOI: ${deal.noi:,.2f}")
            if deal.cap_rate:
                lines.append(f"    Cap Rate: {deal.cap_rate}%")
            if deal.gross_revenue:
                lines.append(f"    Gross Revenue: ${deal.gross_revenue:,.2f}")
            if deal.operating_expenses:
                lines.append(f"    Operating Expenses: ${deal.operating_expenses:,.2f}")
            if deal.cash_on_cash:
                lines.append(f"    Cash-on-Cash: {deal.cash_on_cash}%")
            if deal.ai_summary:
                lines.append(f"    AI Analysis: {deal.ai_summary[:300]}")

    lines.append(f"=== END APARTMENT REPORT ===")

    return "\n".join(lines), doc_ids


async def chat_with_rag(
    query: str,
    tenant_id: int,
    property_id: Optional[int] = None,
    property_name: Optional[str] = None,
    history: Optional[list] = None,
    db: Optional[AsyncSession] = None,
) -> dict:
    """
    RAG chat: retrieve relevant document chunks, build context, generate response.
    Returns answer with source citations.
    Detects apartment-specific queries and injects structured database context.
    """
    client = _get_client()
    if not client:
        return {
            "answer": "The AI assistant is not configured. Please set the OPENAI_API_KEY.",
            "sources": [],
        }

    # ── Detect apartment-specific queries ──
    apartment_context = None
    unit_doc_ids = None
    unit_id = _detect_apartment_query(query)
    logger.info(f"[RAG] Query: '{query}' | Detected unit_id: '{unit_id}' | property_id: {property_id} | db: {db is not None}")
    if unit_id and property_id and db:
        apartment_context, unit_doc_ids = await _get_apartment_context(unit_id, property_id, db)
        logger.info(f"[RAG] Apartment context found: {apartment_context is not None} | Doc IDs: {unit_doc_ids}")

    # 1. Retrieve relevant chunks from vector store
    search_results = await search_vectors(
        query=query,
        tenant_id=tenant_id,
        top_k=8,
        property_id=property_id,
        document_ids=unit_doc_ids if unit_doc_ids else None,
    )
    
    # Fallback: if filtered search returned nothing but we have unit docs, try searching those docs specifically
    if unit_doc_ids and not search_results:
        search_results = await search_vectors(
            query=f"apartment unit {unit_id} lease details financial metrics",
            tenant_id=tenant_id,
            top_k=8,
            property_id=property_id,
            document_ids=unit_doc_ids,
        )

    # 2. Build context from retrieved chunks
    context_parts = []
    sources = []
    seen_docs = set()

    for result in search_results:
        chunk_text = result.get("chunk_text", "")
        if chunk_text:
            doc_id = result.get("doc_id")
            context_parts.append(
                f"[Source: {result.get('filename', 'unknown')} | "
                f"Category: {result.get('category', 'unknown')}]\n{chunk_text}"
            )

            if doc_id not in seen_docs:
                seen_docs.add(doc_id)
                sources.append({
                    "doc_id": doc_id,
                    "filename": result.get("filename", ""),
                    "score": round(result.get("score", 0), 3),
                    "snippet": chunk_text[:200],
                    "page": result.get("chunk_index", 0),
                })

    context = "\n\n---\n\n".join(context_parts) if context_parts else "No relevant documents found in the database."

    # 3. Build conversation messages
    system_instruction = f"""You are the Investment Concierge — an AI assistant for real estate portfolio analysis.
You have access to the property document database and provide data-driven answers."""

    if property_name:
        system_instruction += f"\n\nCURRENT FOCUS: You are currently analyzing the property: **{property_name}**."

    system_instruction += """

RULES:
1. Base your answers ONLY on the provided document context and apartment database records.
2. When citing information, reference the source document filename.
3. If the context doesn't contain the answer, say so clearly.
4. Use specific numbers, dates, and financial figures when available.
5. Format financial data clearly (currency, percentages, dates).
6. Be concise but thorough — focus on actionable insights.

FORMATTING RULES FOR APARTMENT DETAILS:
When responding about a specific apartment or unit, you MUST format your response as a structured report using markdown:

Use this EXACT format:
## 🏠 Unit [Number] — [Status]

### 📋 Unit Overview
| Field | Value |
|-------|-------|
| Unit Type | ... |
| Floor | ... |
| Bedrooms | ... |
| Bathrooms | ... |
| Sq. Ft. | ... |
| Status | ... |

### 💰 Financial Summary
| Metric | Value |
|--------|-------|
| Monthly Rent | ... |
| Annual Rent | ... |
| (any deal metrics available) | ... |

### 📄 Lease Information
| Field | Value |
|-------|-------|
| Tenant | ... |
| Lease Start | ... |
| Lease End | ... |
| Lease Status | ... |
| Days Remaining | ... |

### 📁 Linked Documents
List each document with its status icon and category.

### 📊 AI Deal Analysis
If deal metrics exist, present key findings.

### ⚡ Key Insights
Provide 2-3 actionable insights based on the data (e.g., lease expiration warnings, rent optimization, document gaps).

Always use the structured format above when apartment data is available. Use emoji icons for section headers. Present data in tables for readability.
CRITICAL: You MUST use double newlines between sections, headers, and paragraphs to ensure the markdown renders correctly in the chat UI. Do not smash text together. Use standard markdown table syntax with proper spacing. Use bold text for key labels. Show currency with $ sign and commas. Show dates clearly. If information is missing, use "Not specified" or "---". Avoid long walls of text. Use bullet points for lists. Use emojis to make the report feel premium. Your response will be rendered as high-fidelity markdown. Format it for maximum clarity."""

    if apartment_context:
        system_instruction += f"""

APARTMENT DATABASE RECORD (use this as the PRIMARY source for apartment details):
{apartment_context}"""

    system_instruction += f"""

DOCUMENT CONTEXT:
{context}"""

    messages = [
        {
            "role": "system",
            "content": system_instruction
        }
    ]

    # Add conversation history
    if history:
        for msg in history[-6:]:  # Last 3 exchanges
            messages.append({"role": "user", "content": msg.get("message", "")})
            if msg.get("response"):
                messages.append({"role": "assistant", "content": msg["response"]})

    messages.append({"role": "user", "content": query})

    # 4. Generate response
    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            temperature=0.2,
            max_tokens=2500,
        )

        answer = response.choices[0].message.content
        return {
            "answer": answer,
            "sources": sources,
        }
    except Exception as e:
        logger.error(f"RAG chat failed: {e}")
        return {
            "answer": f"I encountered an error processing your request: {str(e)}",
            "sources": [],
        }
