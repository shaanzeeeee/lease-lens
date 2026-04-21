"""
OCR service: AWS Textract integration with PyPDF2 fallback.
"""
import os
import asyncio
import logging
from typing import Optional

import boto3
from botocore.exceptions import ClientError, NoCredentialsError

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


async def extract_text_from_file(file_bytes: bytes, file_type: str) -> dict:
    """
    Extract text from a document using AWS Textract.
    Falls back to basic PDF text extraction if Textract is unavailable.

    Returns:
        {
            "text": str,
            "confidence": float (0-100),
            "blocks": list[dict],
            "method": "textract" | "pypdf2" | "none"
        }
    """
    # Try AWS Textract first
    try:
        return await _extract_with_textract(file_bytes)
    except (NoCredentialsError, ClientError) as e:
        logger.warning(f"Textract unavailable: {e}. Falling back to PyPDF2.")

    # Fallback: PyPDF2 for PDFs
    if file_type == "pdf":
        try:
            return _extract_with_pypdf2(file_bytes)
        except Exception as e:
            logger.error(f"PyPDF2 extraction failed: {e}")

    return {
        "text": "",
        "confidence": 0.0,
        "blocks": [],
        "method": "none",
    }


async def _extract_with_textract(file_bytes: bytes) -> dict:
    """Use AWS Textract to detect text in a document."""
    def _call_textract():
        client = boto3.client(
            "textract",
            region_name=settings.AWS_REGION,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        )
        return client.detect_document_text(
            Document={"Bytes": file_bytes}
        )

    response = await asyncio.to_thread(_call_textract)

    blocks = response.get("Blocks", [])
    lines = []
    confidences = []

    for block in blocks:
        if block["BlockType"] == "LINE":
            lines.append(block.get("Text", ""))
            confidences.append(block.get("Confidence", 0))

    text = "\n".join(lines)
    avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0

    return {
        "text": text,
        "confidence": round(avg_confidence, 2),
        "blocks": [
            {
                "text": b.get("Text", ""),
                "confidence": b.get("Confidence", 0),
                "type": b.get("BlockType", ""),
                "geometry": b.get("Geometry", {}),
            }
            for b in blocks
            if b["BlockType"] in ("LINE", "WORD")
        ],
        "method": "textract",
    }


def _extract_with_pypdf2(file_bytes: bytes) -> dict:
    """Fallback: extract text from PDF using PyPDF2."""
    import io
    from PyPDF2 import PdfReader

    reader = PdfReader(io.BytesIO(file_bytes))
    pages_text = []

    for page in reader.pages:
        text = page.extract_text()
        if text:
            pages_text.append(text.strip())

    full_text = "\n\n".join(pages_text)

    return {
        "text": full_text,
        "confidence": 70.0 if full_text else 0.0,  # Moderate confidence for PDF extraction
        "blocks": [],
        "method": "pypdf2",
    }
