"""
Pinecone vector store service for RAG document embeddings.
"""
import asyncio
import logging
import hashlib
from typing import Optional, List

from openai import OpenAI
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


def _get_openai_client() -> Optional[OpenAI]:
    if not settings.OPENAI_API_KEY:
        return None
    return OpenAI(api_key=settings.OPENAI_API_KEY)


def _get_pinecone_index():
    """Initialize and return the Pinecone index."""
    try:
        from pinecone import Pinecone
        pc = Pinecone(api_key=settings.PINECONE_API_KEY)
        return pc.Index(settings.PINECONE_INDEX)
    except Exception as e:
        logger.error(f"Pinecone init failed: {e}")
        return None


def _chunk_text(text: str, chunk_size: int = 1000, overlap: int = 200) -> list[str]:
    """Split text into overlapping chunks for embedding."""
    if not text:
        return []

    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end]
        if chunk.strip():
            chunks.append(chunk.strip())
        start = end - overlap

    return chunks


def _get_embedding(text: str, client: OpenAI) -> list[float]:
    """Get OpenAI embedding for a text chunk."""
    response = client.embeddings.create(
        model="text-embedding-3-small",
        input=text[:8000],  # Token limit safety
    )
    return response.data[0].embedding


async def _get_embedding_async(text: str, client: OpenAI) -> list[float]:
    """Get OpenAI embedding for a text chunk (async-friendly)."""
    return await asyncio.to_thread(_get_embedding, text, client)


async def upsert_document(
    doc_id: int,
    text: str,
    metadata: dict,
    tenant_id: int,
) -> int:
    """
    Chunk document text, generate embeddings, and upsert to Pinecone.
    Returns the number of chunks indexed.
    """
    client = _get_openai_client()
    index = _get_pinecone_index()

    if not client or not index or not text.strip():
        logger.warning("Vectorstore upsert skipped: missing client, index, or text")
        return 0

    chunks = _chunk_text(text)
    vectors = []

    for i, chunk in enumerate(chunks):
        try:
            embedding = await _get_embedding_async(chunk, client)
            chunk_id = f"doc-{doc_id}-chunk-{i}"
            vectors.append({
                "id": chunk_id,
                "values": embedding,
                "metadata": {
                    **metadata,
                    "doc_id": doc_id,
                    "tenant_id": tenant_id,
                    "chunk_index": i,
                    "chunk_text": chunk[:1000],  # Store snippet for retrieval
                },
            })
        except Exception as e:
            logger.error(f"Embedding failed for chunk {i} of doc {doc_id}: {e}")

    if vectors:
        try:
            # Upsert in batches of 100
            for batch_start in range(0, len(vectors), 100):
                batch = vectors[batch_start:batch_start + 100]
                await asyncio.to_thread(index.upsert, vectors=batch)
            logger.info(f"Upserted {len(vectors)} chunks for doc {doc_id}")
        except Exception as e:
            logger.error(f"Pinecone upsert failed: {e}")
            return 0

    return len(vectors)


async def search_vectors(
    query: str,
    tenant_id: int,
    top_k: int = 5,
    property_id: Optional[int] = None,
    document_ids: Optional[List[int]] = None,
) -> list[dict]:
    """
    Semantic search across indexed documents.
    Returns ranked results with metadata and snippet text.
    """
    client = _get_openai_client()
    index = _get_pinecone_index()

    if not client or not index:
        return []

    try:
        query_embedding = await _get_embedding_async(query, client)

        # Build filter
        filter_dict = {"tenant_id": {"$eq": tenant_id}}
        if property_id:
            filter_dict["property_id"] = {"$eq": property_id}
        
        if document_ids:
            filter_dict["doc_id"] = {"$in": document_ids}

        results = await asyncio.to_thread(
            index.query,
            vector=query_embedding,
            top_k=top_k,
            include_metadata=True,
            filter=filter_dict,
        )

        return [
            {
                "doc_id": match.metadata.get("doc_id"),
                "filename": match.metadata.get("filename", ""),
                "category": match.metadata.get("category", ""),
                "chunk_text": match.metadata.get("chunk_text", ""),
                "score": match.score,
                "chunk_index": match.metadata.get("chunk_index", 0),
            }
            for match in results.matches
        ]
    except Exception as e:
        logger.error(f"Vector search failed: {e}")
        return []


async def delete_document_vectors(doc_id: int) -> bool:
    """Remove all vectors for a specific document."""
    index = _get_pinecone_index()
    if not index:
        return False

    try:
        # Delete by metadata filter if supported, otherwise by ID
        # Most modern Pinecone indexes support metadata filtering for deletes
        await asyncio.to_thread(index.delete, filter={"doc_id": {"$eq": doc_id}})
        return True
    except Exception as e:
        logger.warning(f"Vector delete by filter failed: {e}. Falling back to ID-based delete.")
        try:
            # Fallback for older tiers: delete by ID (up to 250 chunks)
            ids_to_delete = [f"doc-{doc_id}-chunk-{i}" for i in range(250)]
            await asyncio.to_thread(index.delete, ids=ids_to_delete)
            return True
        except Exception as e2:
            logger.error(f"Fallback vector delete failed: {e2}")
            return False


async def delete_property_vectors(property_id: int) -> bool:
    """Remove all vectors associated with a property."""
    index = _get_pinecone_index()
    if not index:
        return False

    try:
        await asyncio.to_thread(index.delete, filter={"property_id": {"$eq": property_id}})
        return True
    except Exception as e:
        logger.error(f"Failed to delete property vectors: {e}")
        return False
