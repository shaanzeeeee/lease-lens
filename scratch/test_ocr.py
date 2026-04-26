
import asyncio
import os
import sys

# Set DATABASE_URL BEFORE importing app
abs_path = os.path.abspath("backend/test.db")
os.environ["DATABASE_URL"] = f"sqlite:///{abs_path}"

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), "backend"))

from app.services.ocr import extract_text_from_file

async def test_ocr():
    # Load a test PDF bytes from uploads if possible
    upload_dir = "backend/uploads"
    if not os.path.exists(upload_dir):
        print(f"Uploads dir not found at {upload_dir}")
        return
    
    files = [f for f in os.listdir(upload_dir) if f.endswith(".pdf")]
    if not files:
        print("No PDF files found in uploads")
        return
    
    test_file = os.path.join(upload_dir, files[0])
    print(f"Testing OCR with {test_file}")
    
    with open(test_file, "rb") as f:
        file_bytes = f.read()
    
    try:
        result = await extract_text_from_file(file_bytes, "pdf")
        print(f"OCR Method: {result.get('method')}")
        print(f"OCR Confidence: {result.get('confidence')}")
        print(f"OCR Text Length: {len(result.get('text', ''))}")
        if result.get("text"):
            print("Preview:", result.get("text")[:200])
        else:
            print("FAILED: No text extracted")
    except Exception as e:
        print(f"OCR Exception: {e}")

if __name__ == "__main__":
    asyncio.run(test_ocr())
