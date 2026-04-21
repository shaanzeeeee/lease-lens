"""
RAG (Retrieval-Augmented Generation) chat service.
Combines vector search with LLM for source-cited responses.
"""
import json
import logging
from typing import Optional, List

from openai import OpenAI
from app.config import get_settings
from app.services.vectorstore import search_vectors

logger = logging.getLogger(__name__)
settings = get_settings()


def _get_client() -> Optional[OpenAI]:
    if not settings.OPENAI_API_KEY:
        return None
    return OpenAI(api_key=settings.OPENAI_API_KEY)


async def chat_with_rag(
    query: str,
    tenant_id: int,
    property_id: Optional[int] = None,
    history: Optional[list] = None,
) -> dict:
    """
    RAG chat: retrieve relevant document chunks, build context, generate response.
    Returns answer with source citations.
    """
    client = _get_client()
    if not client:
        return {
            "answer": "The AI assistant is not configured. Please set the OPENAI_API_KEY.",
            "sources": [],
        }

    # 1. Retrieve relevant chunks from vector store
    search_results = await search_vectors(
        query=query,
        tenant_id=tenant_id,
        top_k=6,
        property_id=property_id,
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
    messages = [
        {
            "role": "system",
            "content": f"""You are the Investment Concierge — an AI assistant for real estate portfolio analysis.
You have access to the property document database and provide data-driven answers.

RULES:
1. Base your answers ONLY on the provided document context.
2. When citing information, reference the source document filename.
3. If the context doesn't contain the answer, say so clearly.
4. Use specific numbers, dates, and financial figures when available.
5. Format financial data clearly (currency, percentages, dates).
6. Be concise but thorough — focus on actionable insights.

DOCUMENT CONTEXT:
{context}"""
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
            max_tokens=1500,
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
