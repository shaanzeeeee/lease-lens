# Real Estate Manager Backend

FastAPI backend for the Real Estate AI Acquisition platform.

## 🚀 Running the Backend

### 1. Setup Environment
```bash
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 2. Configuration
Ensure your `.env` file is configured with the following:
- `DATABASE_URL`
- `OPENAI_API_KEY`
- `AWS_ACCESS_KEY_ID` / `SECRET_ACCESS_KEY`
- `PINECONE_API_KEY`

### 3. Run Server
```bash
python -m uvicorn app.main:app --reload
```

## 🔐 Credentials
- **Admin:** `admin@abelam.com` / `admin123`
