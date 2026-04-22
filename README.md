# Real Estate AI Acquisition Tool

An AI-powered platform for real estate investment analysis, portfolio management, and automated document processing using Agentic RAG.

## 🏗️ Project Architecture

- **Frontend:** React + TypeScript + Vite + Tailwind CSS
- **Backend:** FastAPI (Python) + SQLite + SQLAlchemy
- **AI/ML:** OpenAI (GPT-4o), LangGraph, Pinecone (Vector Store), AWS Textract (OCR)

---

## 🚀 Getting Started

### 1. Backend Setup

Navigate to the `backend` directory:
```bash
cd backend
```

#### Create Virtual Environment (Recommended)
```bash
python -m venv venv
.\venv\Scripts\Activate.ps1  # Windows
# source venv/bin/activate   # macOS/Linux
```

#### Install Dependencies
```bash
pip install -r requirements.txt
```

#### Run Backend Server
```bash
python -m uvicorn app.main:app --reload
```
The API will be available at [http://127.0.0.1:8001](http://127.0.0.1:8001).
Documentation (Swagger UI) is at [http://127.0.0.1:8001/docs](http://127.0.0.1:8001/docs).

---

### 2. Frontend Setup

Navigate to the `frontend` directory:
```bash
cd frontend
```

#### Install Dependencies
```bash
npm install
```

#### Run Frontend Dev Server
```bash
npm run dev
```
The application will be available at [http://localhost:5173](http://localhost:5173).

---

## 🔐 Authentication & Demo Data

The system initializes with a demo tenant and an admin user:

- **Admin Email:** `admin@abelam.com`
- **Password:** `admin123`

---

## 📂 Project Structure

- `backend/app/`: Core FastAPI application logic.
  - `routers/`: API endpoints.
  - `models/`: Database schemas.
  - `agents/`: AI agents and LangGraph workflows.
  - `services/`: RAG, OCR, and external integrations.
- `frontend/src/`: React frontend application.
  - `pages/`: UI views.
  - `components/`: Reusable UI elements.
  - `services/`: API integration layer.
