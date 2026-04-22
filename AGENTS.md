# Abelam Private Ledger - Project Documentation

## Overview

**Abelam Private Ledger** is an AI-powered real estate acquisition platform built with FastAPI (backend) and React/TypeScript (frontend). It uses a LangGraph-based agentic pipeline to process property documents, extract financial data, perform underwriting analysis, and generate deal reports.

---

## Architecture

### Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | FastAPI, SQLAlchemy (async), SQLite |
| Frontend | React 18, TypeScript, Vite |
| AI/ML | OpenAI API, LangGraph, LangChain |
| OCR | Tesseract (via pytesseract) |
| Database | SQLite (development) |

---

## Project Structure

```
real-estate-manager/
├── backend/
│   ├── app/
│   │   ├── agents/           # LangGraph pipeline agents
│   │   │   ├── graph.py      # Main pipeline orchestration
│   │   │   ├── state.py      # PipelineState definition
│   │   │   ├── intake.py     # Intake agent
│   │   │   ├── extraction.py # Extraction agent
│   │   │   ├── validation.py # Validation agent
│   │   │   ├── underwriting.py # Underwriting agent
│   │   │   └── reporting.py  # Reporting agent
│   │   ├── routers/          # FastAPI endpoints
│   │   ├── services/         # Business logic
│   │   │   ├── ocr.py        # OCR processing
│   │   │   ├── structuring.py # AI classification & extraction
│   │   │   ├── rag.py        # RAG chatbot service
│   │   │   └── vectorstore.py # Vector store for RAG
│   │   ├── models.py         # SQLAlchemy ORM models
│   │   ├── schemas.py        # Pydantic schemas
│   │   ├── database.py       # DB connection
│   │   ├── auth.py           # Authentication
│   │   └── main.py           # FastAPI app entry
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── pages/            # React pages
│   │   ├── components/       # Reusable components
│   │   ├── context/          # React contexts
│   │   └── api/              # API client
│   └── package.json
└── README.md
```

---

## Data Model

### Entity Hierarchy

```
Tenant
  └── User
  └── Property
        ├── Document (categorized by type)
        │     └── Deal (AI analysis results)
        ├── Apartment (units)
        └── ChatMessage (RAG conversations)
```

### Key Models

- **Tenant**: Multi-tenant organization isolation
- **User**: Role-based access (admin, analyst, viewer)
- **Property**: Real estate asset with address, type, unit count
- **Apartment**: Individual unit within a property
- **Document**: Uploaded PDF/image with OCR text and AI categorization
- **Deal**: Structured financial analysis from the agent pipeline
- **ChatMessage**: RAG chatbot conversation history

---

## LangGraph Agent Pipeline

The core of the system is a **5-agent LangGraph pipeline** that processes documents end-to-end:

```
┌─────────┐   ┌───────────┐   ┌────────────┐   ┌─────────────┐   ┌──────────┐
│ INTAKE  │──▶│ EXTRACTION│──▶│ VALIDATION │──▶│UNDERWRITING │──▶│ REPORTING│
└─────────┘   └───────────┘   └────────────┘   └─────────────┘   └──────────┘
     │             │              │                  │                │
     │             │              │                  │                │
     │        Classify &     Check data         Calculate         Generate
     │        extract data    consistency       metrics           executive
     │                                                       summary
     │             │              │                  │                │
     │             │        ┌─────┴──────┐          │                │
     │             │        │            │          │                │
     │             │    Retry       Proceed       End               End
     │             │  (max 3)                                    (stage=
     │             │                                             "complete")
     └─────────────┴──────────────────────────────────────────────┘
                        Conditional Edge
```

### Pipeline State (`PipelineState`)

```python
class PipelineState(TypedDict):
    messages: list                    # LangGraph message accumulator
    document_id: int                  # Document identifier
    property_id: int                  # Property identifier
    tenant_id: int                    # Tenant identifier
    raw_text: str                     # OCR text from document
    filename: str                     # Original filename
    file_type: str                    # PDF, JPG, etc.
    category: str                     # Document category (lease, expense, etc.)
    subcategory: Optional[str]        # Subcategory
    extracted_data: dict              # AI-extracted structured data
    validation_errors: list           # Validation issues
    underwriting_result: dict         # Financial metrics & risks
    report: str                       # Final markdown report
    summary: str                      # Executive summary
    stage: str                        # Current pipeline stage
    iterations: int                   # Retry counter
    error: Optional[str]              # Error message
```

### Agent Details

| Agent | Responsibility | Outputs |
|-------|----------------|---------|
| **Intake** | Log document, validate file type, initial categorization | `category`, `stage` |
| **Extraction** | AI classify document, extract structured fields | `category`, `subcategory`, `extracted_data` |
| **Validation** | Check data consistency, validate financials, flag issues | `validation_errors`, `stage` (may loop back) |
| **Underwriting** | Calculate NOI, cap rate, GRM, cash-on-cash, risk scoring | `underwriting_result` (metrics, risks, deal_score) |
| **Reporting** | Generate AI-written executive summary, compile final report | `report`, `summary`, `stage: "complete"` |

### Routing Logic

- **After Intake**: If error → END; else → EXTRACTION
- **After Validation**: If errors exist AND iterations < 3 → EXTRACTION (retry); else → UNDERWRITING
- **After Underwriting**: Always → REPORTING
- **After Reporting**: Always → END

---

## API Endpoints

| Router | Prefix | Endpoints |
|--------|--------|-----------|
| `auth` | `/api/auth` | Login, register, token refresh |
| `documents` | `/api/documents` | Upload, list, get OCR results, trigger pipeline |
| `assets` | `/api/properties` | CRUD properties, apartments |
| `agents` | `/api/agents` | Trigger pipeline, get status |
| `chat` | `/api/chat` | RAG chatbot conversations |
| `deals` | `/api/deals` | View processed deals |

---

## Frontend Pages

| Page | Description |
|------|-------------|
| **Login** | Authentication page |
| **Dashboard** | Overview with metrics and recent activity |
| **Properties** | List of properties with search/filter |
| **PropertyDetail** | Property details, documents, deals |
| **HitlQueue** | Human-in-the-loop review queue for flagged documents |
| **Concierge** | RAG-powered chatbot interface |

---

## Key Features

1. **Document Processing Pipeline**: Upload PDF → OCR → AI classification → Financial extraction → Underwriting → Report
2. **Multi-tenant Isolation**: Each organization (tenant) has isolated data
3. **Role-based Access**: Admin, analyst, viewer roles
4. **RAG Chatbot**: Ask questions about property documents using vector search + LLM
5. **Human-in-the-Loop**: Validation failures can be reviewed manually
6. **Financial Metrics**: NOI, cap rate, GRM, cash-on-cash, expense ratio, deal score

---

## Running the Project

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Demo Credentials

- Email: `admin@abelam.com`
- Password: `admin123`

---

## Configuration

Environment variables (`.env`):
- `DATABASE_URL`: SQLite connection string
- `OPENAI_API_KEY`: OpenAI API key for GPT models
- `CORS_ORIGINS`: Allowed frontend origins
- `SECRET_KEY`: JWT signing key