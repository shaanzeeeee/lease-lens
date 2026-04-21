"""
SQLAlchemy ORM models for the Real Estate Management platform.
Reflects the property-level document hierarchy:
  Property → Documents (categorized)
           → Apartments (units within the property)
           → Expenses (categorized by type)
           → Deals (structured financial data)
"""
import datetime
from sqlalchemy import (
    Column, Integer, String, Text, Float, Boolean, DateTime,
    ForeignKey, JSON, Enum as SAEnum
)
from sqlalchemy.orm import relationship
from app.database import Base
import enum


class DocumentCategory(str, enum.Enum):
    DUE_DILIGENCE = "due_diligence"
    LEASE = "lease"
    EXPENSE = "expense"
    FINANCIAL = "financial"
    LEGAL = "legal"
    CONDITION = "condition"
    PHOTO = "photo"
    OTHER = "other"


class DocumentStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    NEEDS_REVIEW = "needs_review"
    VERIFIED = "verified"
    FAILED = "failed"


class DealStage(str, enum.Enum):
    INTAKE = "intake"
    EXTRACTION = "extraction"
    VALIDATION = "validation"
    UNDERWRITING = "underwriting"
    REPORTING = "reporting"
    COMPLETE = "complete"


class Tenant(Base):
    """Multi-tenant isolation: each tenant is a separate organization."""
    __tablename__ = "tenants"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    slug = Column(String(100), unique=True, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    users = relationship("User", back_populates="tenant", cascade="all, delete-orphan")
    properties = relationship("Property", back_populates="tenant", cascade="all, delete-orphan")


class User(Base):
    """User accounts with role-based access control."""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(String(50), default="analyst")  # admin, analyst, viewer
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    tenant = relationship("Tenant", back_populates="users")
    chat_messages = relationship("ChatMessage", back_populates="user", cascade="all, delete-orphan")


class Property(Base):
    """
    A physical real estate asset (building/property).
    Top-level entity that contains documents, apartments, and expenses.
    """
    __tablename__ = "properties"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    address = Column(Text)
    city = Column(String(255))
    province_state = Column(String(100))
    postal_code = Column(String(20))
    property_type = Column(String(100))  # multi-family, commercial, industrial
    unit_count = Column(Integer, default=0)
    status = Column(String(50), default="active")  # active, under_review, archived
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    # Relationships
    tenant = relationship("Tenant", back_populates="properties")
    documents = relationship("Document", back_populates="property", cascade="all, delete-orphan")
    apartments = relationship("Apartment", back_populates="property", cascade="all, delete-orphan")
    deals = relationship("Deal", back_populates="property", cascade="all, delete-orphan")


class Apartment(Base):
    """Individual unit within a property (e.g., Apt. 3, Apt. 31)."""
    __tablename__ = "apartments"

    id = Column(Integer, primary_key=True, index=True)
    property_id = Column(Integer, ForeignKey("properties.id"), nullable=False, index=True)
    unit_number = Column(String(50), nullable=False)  # "3", "8_Janitor_Residence", "9_&_Apt.4_Combined"
    unit_type = Column(String(100))  # residential, janitor, combined, commercial
    floor = Column(Integer)
    bedrooms = Column(Integer)
    bathrooms = Column(Float)
    square_feet = Column(Float)
    monthly_rent = Column(Float)
    lease_start = Column(DateTime)
    lease_end = Column(DateTime)
    tenant_name = Column(String(255))
    status = Column(String(50), default="occupied")  # occupied, vacant, renovating

    # Relationships
    property = relationship("Property", back_populates="apartments")
    documents = relationship("Document", back_populates="apartment")


class Document(Base):
    """
    An uploaded document (PDF, image) linked to a property.
    Organized by category matching the folder structure:
      - due_diligence: certificates, offers, evaluations, photos
      - lease: per-apartment lease documents
      - expense: insurance, taxes, utilities, maintenance
    """
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    property_id = Column(Integer, ForeignKey("properties.id"), nullable=False, index=True)
    apartment_id = Column(Integer, ForeignKey("apartments.id"), nullable=True, index=True)
    filename = Column(String(500), nullable=False)
    original_filename = Column(String(500), nullable=False)
    file_path = Column(Text, nullable=False)
    file_type = Column(String(50))  # pdf, jpg, png, tiff
    file_size = Column(Integer)  # bytes
    category = Column(String(50), default=DocumentCategory.OTHER.value, index=True)
    subcategory = Column(String(100))  # e.g., "School_Tax", "Hydro_&_Energir", "Municipal_Tax"
    ocr_text = Column(Text, default="")
    ocr_confidence = Column(Float, default=0.0)
    ocr_blocks = Column(JSON, default=list)
    status = Column(String(50), default=DocumentStatus.PENDING.value, index=True)
    ai_category = Column(String(100))  # AI-determined category
    ai_summary = Column(Text)
    metadata_json = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
 
    @property
    def deal_id(self):
        from sqlalchemy.orm import attributes
        if "deals" not in attributes.instance_state(self).unloaded:
            return self.deals[0].id if self.deals else None
        return None

    # Relationships
    property = relationship("Property", back_populates="documents")
    apartment = relationship("Apartment", back_populates="documents")
    deals = relationship("Deal", back_populates="document", cascade="all, delete-orphan")


class Deal(Base):
    """
    A structured financial analysis derived from property documents.
    Created by the AI agent pipeline (LangGraph).
    """
    __tablename__ = "deals"

    id = Column(Integer, primary_key=True, index=True)
    property_id = Column(Integer, ForeignKey("properties.id"), nullable=False, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=True, index=True)
    deal_name = Column(String(255), nullable=False)
    stage = Column(String(50), default=DealStage.INTAKE.value, index=True)

    # Financials (extracted by AI)
    purchase_price = Column(Float)
    asking_price = Column(Float)
    noi = Column(Float)  # Net Operating Income
    cap_rate = Column(Float)  # Capitalization Rate
    gross_revenue = Column(Float)
    operating_expenses = Column(Float)
    cash_on_cash = Column(Float)
    price_per_unit = Column(Float)
    grm = Column(Float)  # Gross Rent Multiplier

    # Structured data blob (full AI extraction)
    structured_data = Column(JSON, default=dict)
    lease_summary = Column(JSON, default=list)  # Array of lease term objects
    expense_breakdown = Column(JSON, default=dict)

    # AI-generated content
    ai_summary = Column(Text)
    ai_report = Column(Text)  # Full underwriting report

    # Pipeline tracking
    pipeline_log = Column(JSON, default=list)  # Timestamped agent actions
    validation_errors = Column(JSON, default=list)

    # Timestamps
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    # Relationships
    property = relationship("Property", back_populates="deals")
    document = relationship("Document", back_populates="deals")


class ChatMessage(Base):
    """RAG chatbot conversation history with source citations."""
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    property_id = Column(Integer, ForeignKey("properties.id"), nullable=True, index=True)
    message = Column(Text, nullable=False)
    response = Column(Text)
    sources = Column(JSON, default=list)  # [{doc_id, filename, page, score, snippet}]
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="chat_messages")
