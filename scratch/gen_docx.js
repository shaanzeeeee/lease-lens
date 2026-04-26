const fs = require("fs");
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  LevelFormat, ShadingType, VerticalAlign, PageNumber, PageBreak, ImageRun } = require("docx");

const BLUE = "1A56DB";
const DARK = "1F2937";
const GRAY = "6B7280";
const LIGHT_BLUE = "DBEAFE";
const WHITE = "FFFFFF";

const tb = { style: BorderStyle.SINGLE, size: 1, color: "D1D5DB" };
const cb = { top: tb, bottom: tb, left: tb, right: tb };

function hdrCell(text, w) {
  return new TableCell({ borders: cb, width: { size: w, type: WidthType.DXA },
    shading: { fill: BLUE, type: ShadingType.CLEAR }, verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({ alignment: AlignmentType.CENTER,
      children: [new TextRun({ text, bold: true, color: WHITE, size: 20, font: "Arial" })] })] });
}
function cell(text, w) {
  return new TableCell({ borders: cb, width: { size: w, type: WidthType.DXA },
    children: [new Paragraph({ spacing: { before: 40, after: 40 },
      children: [new TextRun({ text, size: 20, font: "Arial", color: DARK })] })] });
}
function statusCell(text, w) {
  const color = text === "Implemented" ? "059669" : text === "Partial" ? "D97706" : "DC2626";
  return new TableCell({ borders: cb, width: { size: w, type: WidthType.DXA },
    children: [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 40, after: 40 },
      children: [new TextRun({ text, bold: true, size: 20, font: "Arial", color })] })] });
}

function h1(text) { return new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 360, after: 200 }, children: [new TextRun({ text })] }); }
function h2(text) { return new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 280, after: 160 }, children: [new TextRun({ text })] }); }
function h3(text) { return new Paragraph({ heading: HeadingLevel.HEADING_3, spacing: { before: 200, after: 120 }, children: [new TextRun({ text })] }); }
function p(text) { return new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text, size: 22, font: "Arial", color: DARK })] }); }
function pb() { return new Paragraph({ children: [new PageBreak()] }); }

function bullet(text, ref) {
  return new Paragraph({ numbering: { reference: ref, level: 0 }, spacing: { after: 60 },
    children: [new TextRun({ text, size: 22, font: "Arial", color: DARK })] });
}

function featureTable(rows) {
  const cw = [4000, 3500, 1860];
  return new Table({ columnWidths: cw, rows: [
    new TableRow({ tableHeader: true, children: [hdrCell("Feature", cw[0]), hdrCell("Details", cw[1]), hdrCell("Status", cw[2])] }),
    ...rows.map(r => new TableRow({ children: [cell(r[0], cw[0]), cell(r[1], cw[1]), statusCell(r[2], cw[2])] }))
  ]});
}

function techTable() {
  const cw = [3120, 3120, 3120];
  const rows = [
    ["Backend", "FastAPI, SQLAlchemy (async), SQLite", "Python 3.13"],
    ["Frontend", "React 18, TypeScript, Vite", "Node.js"],
    ["AI / LLM", "OpenAI GPT-4o, LangGraph, LangChain", "OpenAI API"],
    ["OCR", "AWS Textract, PyMuPDF (fallback)", "AWS SDK"],
    ["Vector Store", "Pinecone (text-embedding-3-small)", "Pinecone API"],
    ["Auth", "JWT (python-jose), bcrypt", "HS256"],
  ];
  return new Table({ columnWidths: cw, rows: [
    new TableRow({ tableHeader: true, children: [hdrCell("Layer", cw[0]), hdrCell("Technology", cw[1]), hdrCell("Runtime", cw[2])] }),
    ...rows.map(r => new TableRow({ children: [cell(r[0], cw[0]), cell(r[1], cw[1]), cell(r[2], cw[2])] }))
  ]});
}

function apiTable() {
  const cw = [2340, 2340, 4680];
  const rows = [
    ["Auth", "/api/auth", "Login, register, JWT token management"],
    ["Documents", "/api/documents", "Upload, list, get, verify, delete documents"],
    ["Properties", "/api/properties", "CRUD for properties and apartment units"],
    ["Agents", "/api/agents", "Trigger AI pipeline, status, WebSocket updates"],
    ["Chat", "/api/chat", "RAG-powered concierge conversations"],
    ["Deals", "/api/deals", "View AI-generated deal analyses"],
  ];
  return new Table({ columnWidths: cw, rows: [
    new TableRow({ tableHeader: true, children: [hdrCell("Module", cw[0]), hdrCell("Prefix", cw[1]), hdrCell("Endpoints", cw[2])] }),
    ...rows.map(r => new TableRow({ children: [cell(r[0], cw[0]), cell(r[1], cw[1]), cell(r[2], cw[2])] }))
  ]});
}

function agentTable() {
  const cw = [1800, 3200, 4360];
  const rows = [
    ["Intake", "Receives, validates, routes documents", "Initial classification by filename pattern, text length validation"],
    ["Extraction", "AI classification and data extraction", "GPT-4o classifies documents into 7 categories, extracts structured financial fields"],
    ["Validation", "Data consistency and completeness checks", "NOI consistency, cap rate validation, negative value checks, retry loop (max 3)"],
    ["Underwriting", "Financial metric calculations", "Computes NOI, Cap Rate, GRM, Cash-on-Cash, Expense Ratio, Deal Score (0-100)"],
    ["Reporting", "AI-generated executive summaries", "GPT-4o writes 3-5 paragraph deal summary with risk factors and recommendation"],
  ];
  return new Table({ columnWidths: cw, rows: [
    new TableRow({ tableHeader: true, children: [hdrCell("Agent", cw[0]), hdrCell("Role", cw[1]), hdrCell("Details", cw[2])] }),
    ...rows.map(r => new TableRow({ children: [cell(r[0], cw[0]), cell(r[1], cw[1]), cell(r[2], cw[2])] }))
  ]});
}

// Load screenshot images
const scrDir = "C:\\Users\\Shaan\\.gemini\\antigravity\\brain\\ec4d8cd6-309f-4d78-b2d2-f8a3216b4388";
let loginImg, dashImg, propsImg;
try { loginImg = fs.readFileSync(scrDir + "\\login_page_1777194622908.png"); } catch(e) { loginImg = null; }
try { dashImg = fs.readFileSync(scrDir + "\\dashboard_page_1777194744522.png"); } catch(e) { dashImg = null; }
try { propsImg = fs.readFileSync(scrDir + "\\properties_page_1777194788425.png"); } catch(e) { propsImg = null; }

function imgParagraph(data, title, desc) {
  if (!data) return p("[Screenshot not available]");
  return new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200, after: 200 },
    children: [new ImageRun({ type: "png", data, transformation: { width: 580, height: 326 },
      altText: { title, description: desc, name: title } })] });
}

const doc = new Document({
  styles: {
    default: { document: { run: { font: "Arial", size: 22, color: DARK } } },
    paragraphStyles: [
      { id: "Title", name: "Title", basedOn: "Normal",
        run: { size: 56, bold: true, color: BLUE, font: "Arial" },
        paragraph: { spacing: { before: 240, after: 60 }, alignment: AlignmentType.CENTER } },
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 32, bold: true, color: BLUE, font: "Arial" },
        paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 26, bold: true, color: DARK, font: "Arial" },
        paragraph: { spacing: { before: 280, after: 160 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, color: "374151", font: "Arial" },
        paragraph: { spacing: { before: 200, after: 120 }, outlineLevel: 2 } },
    ]
  },
  numbering: { config: [
    { reference: "bl1", levels: [{ level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    { reference: "bl2", levels: [{ level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    { reference: "bl3", levels: [{ level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    { reference: "bl4", levels: [{ level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    { reference: "bl5", levels: [{ level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    { reference: "bl6", levels: [{ level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    { reference: "bl7", levels: [{ level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
  ]},
  sections: [
    // COVER PAGE
    { properties: { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
      children: [
        new Paragraph({ spacing: { before: 3600 } , children: [] }),
        new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: "Abelam Private Ledger" })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 400 },
          children: [new TextRun({ text: "AI-Powered Real Estate Acquisition Platform", size: 28, color: GRAY, font: "Arial", italics: true })] }),
        new Paragraph({ spacing: { before: 600 }, children: [] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 },
          children: [new TextRun({ text: "MILESTONE 1 \u2014 TECHNICAL DOCUMENTATION", size: 24, bold: true, color: DARK, font: "Arial" })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 },
          children: [new TextRun({ text: "Document Intake, Processing & AI Agent Pipeline", size: 22, color: GRAY, font: "Arial" })] }),
        new Paragraph({ spacing: { before: 1200 }, children: [] }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Version 1.0  |  April 2026", size: 20, color: GRAY })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [new TextRun({ text: "Confidential \u2014 For Client Review Only", size: 18, color: GRAY, italics: true })] }),
      ]
    },
    // MAIN CONTENT
    { properties: {
        page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } },
      },
      headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT,
        children: [new TextRun({ text: "Abelam Private Ledger \u2014 Milestone 1", size: 16, color: GRAY, italics: true })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "Page ", size: 16, color: GRAY }), new TextRun({ children: [PageNumber.CURRENT], size: 16, color: GRAY }),
          new TextRun({ text: " of ", size: 16, color: GRAY }), new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: GRAY }),
          new TextRun({ text: "  |  Confidential", size: 16, color: GRAY })] })] }) },
      children: [
        // 1. EXECUTIVE SUMMARY
        h1("1. Executive Summary"),
        p("Abelam Private Ledger is an AI-powered real estate acquisition platform designed to automate the document-heavy due diligence process in commercial and multi-family real estate transactions. The platform ingests property documents (leases, rent rolls, offering memorandums, and financial statements), processes them through an intelligent OCR pipeline, and applies a 5-agent AI system to extract, validate, underwrite, and report on each deal."),
        p("Milestone 1 delivers the complete end-to-end pipeline: from document upload through AI-powered analysis to deal report generation. This document provides a technical overview of the implemented architecture, features, and capabilities."),

        // 2. TECHNOLOGY STACK
        h1("2. Technology Stack"),
        p("The platform is built on a modern, production-grade stack:"),
        techTable(),

        pb(),
        // 3. ARCHITECTURE OVERVIEW
        h1("3. Architecture Overview"),
        h2("3.1 System Architecture"),
        p("The system follows a three-tier architecture with clear separation of concerns:"),
        bullet("Frontend (React/TypeScript) \u2014 Single-page application for portfolio management, document upload, and deal review", "bl1"),
        bullet("Backend (FastAPI) \u2014 RESTful API with async SQLAlchemy ORM, JWT authentication, and WebSocket support for real-time pipeline status", "bl1"),
        bullet("AI Pipeline (LangGraph) \u2014 5-agent state machine orchestrating document classification, extraction, validation, underwriting, and reporting", "bl1"),
        bullet("Vector Store (Pinecone) \u2014 Semantic search over indexed document chunks for RAG-powered chatbot", "bl1"),

        h2("3.2 Data Model"),
        p("The entity hierarchy follows a property-centric design:"),
        bullet("Tenant \u2192 Multi-tenant organization isolation", "bl2"),
        bullet("Property \u2192 Real estate asset with address, type, unit count", "bl2"),
        bullet("Document \u2192 Uploaded file with OCR text, AI classification, and processing status", "bl2"),
        bullet("Deal \u2192 Structured financial analysis output from the AI pipeline", "bl2"),
        bullet("Apartment \u2192 Individual unit within a property (rent, lease terms, tenant info)", "bl2"),
        bullet("ChatMessage \u2192 RAG chatbot conversation history with source citations", "bl2"),

        h2("3.3 API Endpoints"),
        p("The backend exposes a RESTful API organized into the following modules:"),
        apiTable(),

        pb(),
        // 4. DOCUMENT INTAKE & PROCESSING
        h1("4. Document Intake & Processing (Section A)"),

        h2("4.1 Document Upload & Acceptance"),
        p("The platform accepts the following document types for real estate due diligence:"),
        bullet("Leases \u2014 Individual apartment lease agreements and renewals", "bl3"),
        bullet("Rent Rolls \u2014 Portfolio-level tenant and revenue summaries", "bl3"),
        bullet("Offering Memorandums \u2014 Investment prospectus with financial projections", "bl3"),
        bullet("Financial Statements \u2014 Operating expense reports, tax assessments, insurance documents", "bl3"),
        p("Documents are uploaded via a multi-file upload endpoint with category tagging. Supported formats include PDF, JPG, PNG, and TIFF. Each document is stored on disk with a UUID-based filename and tracked in the database with full metadata."),

        h2("4.2 OCR Processing"),
        p("The OCR pipeline uses a three-tier extraction strategy for maximum reliability:"),
        bullet("Tier 1 (Institutional Grade): PDF pages are rendered to 300 DPI images using pdf2image or PyMuPDF, then processed page-by-page through AWS Textract for highest fidelity extraction", "bl4"),
        bullet("Tier 2 (Direct Textract): For non-PDF files or as a fallback, documents are sent directly to AWS Textract", "bl4"),
        bullet("Tier 3 (Local Fallback): If cloud services are unavailable, PyPDF2 is used for basic text extraction from digital PDFs", "bl4"),
        p("OCR results include extracted text, confidence scores, and geometric block data. Documents with confidence below 85% are automatically flagged for Human-in-the-Loop (HITL) review."),

        h2("4.3 Auto-Classification & Structured Data Extraction"),
        p("Each document is classified using GPT-4o into one of seven categories: due_diligence, lease, expense, financial, legal, condition, or photo. The AI also assigns a subcategory and confidence score."),
        p("Structured data extraction uses GPT-4o to pull financial fields (purchase price, NOI, cap rate, gross revenue, operating expenses), lease terms (tenant name, unit number, monthly rent, dates), and expense items (type, amount, period, vendor) into a normalized JSON schema."),

        h2("4.4 RAG-Based Document Retrieval"),
        p("After processing, document text is chunked (1000 characters with 200-character overlap), embedded using OpenAI text-embedding-3-small, and stored in a Pinecone vector index with tenant and property-level isolation."),
        p("The RAG chatbot (Investment Concierge) performs semantic search over indexed documents, builds a context window from the top 6 matching chunks, and generates responses using GPT-4o with source citations. Conversation history is maintained for multi-turn interactions."),

        pb(),
        // 5. AI AGENT SYSTEM
        h1("5. AI Agent System \u2014 5 Modular Agents (Section B)"),
        p("The core of the platform is a LangGraph StateGraph pipeline that orchestrates five specialized agents in sequence, with conditional routing for error recovery and HITL escalation."),

        h2("5.1 Pipeline Flow"),
        p("START \u2192 Intake \u2192 Extraction \u2192 Validation \u2192 Underwriting \u2192 Reporting \u2192 END"),
        p("The Validation agent can loop back to Extraction up to 3 times if data inconsistencies are detected. After 3 failed retries, the pipeline halts and escalates to human review."),

        h2("5.2 Agent Details"),
        agentTable(),

        h2("5.3 Underwriting Metrics"),
        p("The Underwriting Agent computes the following financial metrics:"),
        bullet("Net Operating Income (NOI) = Gross Revenue \u2212 Operating Expenses", "bl5"),
        bullet("Cap Rate = (NOI / Purchase Price) \u00D7 100", "bl5"),
        bullet("Gross Rent Multiplier (GRM) = Purchase Price / Gross Revenue", "bl5"),
        bullet("Expense Ratio = (Operating Expenses / Gross Revenue) \u00D7 100", "bl5"),
        bullet("Cash-on-Cash Return = (NOI \u2212 Debt Service) / Down Payment \u00D7 100 (assumes 75% LTV, 6.5% debt constant)", "bl5"),
        bullet("Deal Score (0-100) \u2014 Composite score based on cap rate, cash-on-cash, expense ratio, and risk factors", "bl5"),

        h2("5.4 Risk Flagging"),
        p("The system automatically flags the following risk indicators:"),
        bullet("Cap rate below 4% \u2014 Potentially overpriced asset", "bl6"),
        bullet("Cap rate above 10% \u2014 Higher risk profile", "bl6"),
        bullet("Expense ratio above 55% \u2014 Operating cost concern", "bl6"),
        bullet("Negative cash-on-cash \u2014 Deal may not cash flow", "bl6"),
        bullet("Missing lease data \u2014 Tenant stability unknown", "bl6"),

        pb(),
        // 6. FEATURE STATUS
        h1("6. Milestone 1 Feature Status"),
        h2("6.1 Section A \u2014 Document Intake & Processing"),
        featureTable([
          ["Document acceptance (leases, rent rolls, OMs, financials)", "Multi-file upload with category tagging; PDF, JPG, PNG, TIFF", "Implemented"],
          ["OCR for scanned/image documents", "AWS Textract + pdf2image (300 DPI) + PyPDF2 fallback", "Implemented"],
          ["Auto-classification & extraction", "GPT-4o classification (7 categories) + structured field extraction", "Implemented"],
          ["RAG vector database", "Pinecone with OpenAI embeddings; requires external Pinecone setup", "Partial"],
        ]),
        h2("6.2 Section B \u2014 AI Agent System (LangGraph)"),
        featureTable([
          ["Intake Agent", "Routes, logs, validates file type and content length", "Implemented"],
          ["Extraction Agent", "GPT-4o classification + structured deal data extraction", "Implemented"],
          ["Validation Agent", "NOI/cap rate consistency, retry loop (max 3), HITL escalation", "Implemented"],
          ["Underwriting Agent", "NOI, Cap Rate, GRM, Cash-on-Cash, Deal Score", "Implemented"],
          ["Reporting Agent", "GPT-4o executive summary + markdown deal report", "Implemented"],
        ]),

        pb(),
        // 7. UI SCREENSHOTS
        h1("7. Application Screenshots"),
        h2("7.1 Login Page"),
        p("Secure authentication with JWT-based session management and multi-tenant isolation."),
        imgParagraph(loginImg, "Login Page", "Abelam Private Ledger login screen"),

        h2("7.2 Institutional Dashboard"),
        p("Portfolio overview with real-time metrics: total properties, document count, active deals, and HITL review queue. Recent AI structuring activity is displayed with document status tracking."),
        imgParagraph(dashImg, "Dashboard", "Institutional dashboard with portfolio metrics"),

        h2("7.3 Property Portfolio"),
        p("Grid and list views for managing real estate assets. Each property card shows address, unit count, and quick access to the data room."),
        imgParagraph(propsImg, "Properties", "Property portfolio grid view"),

        pb(),
        // 8. DEPLOYMENT
        h1("8. Deployment & Configuration"),
        h2("8.1 Environment Variables"),
        p("The following environment variables must be configured in the backend .env file:"),
        bullet("OPENAI_API_KEY \u2014 Required for AI classification, extraction, summaries, and embeddings", "bl7"),
        bullet("AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY \u2014 Required for Textract OCR (has PyPDF2 fallback)", "bl7"),
        bullet("PINECONE_API_KEY / PINECONE_INDEX \u2014 Required for RAG vector search (degrades gracefully if absent)", "bl7"),
        bullet("SECRET_KEY \u2014 JWT signing key for authentication", "bl7"),
        bullet("DATABASE_URL \u2014 SQLite connection string (default: sqlite:///./test.db)", "bl7"),

        h2("8.2 Running Locally"),
        p("Backend: python -m uvicorn app.main:app --reload --port 8001"),
        p("Frontend: npm run dev (serves on http://localhost:5173)"),
        p("Docker: docker-compose up --build (full stack with PostgreSQL and Redis)"),

        // 9. NEXT STEPS
        h1("9. Next Steps"),
        p("With Milestone 1 complete, the following enhancements are recommended for Milestone 2:"),
        bullet("PostgreSQL migration for production-grade data persistence", "bl1"),
        bullet("ChromaDB local fallback for RAG when Pinecone is unavailable", "bl1"),
        bullet("Celery/Redis background task queue for scalable document processing", "bl1"),
        bullet("Enhanced HITL review interface with side-by-side OCR correction", "bl1"),
        bullet("Pro-forma financial modeling with interactive projections", "bl1"),
        bullet("Role-based access control enforcement across all endpoints", "bl1"),
      ]
    }
  ]
});

const OUTPUT = "c:\\Users\\Shaan\\Desktop\\Office Stuff\\real-estate-manager\\Abelam_Private_Ledger_Milestone_1_Documentation.docx";
Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync(OUTPUT, buffer);
  console.log("Document generated: " + OUTPUT);
});
