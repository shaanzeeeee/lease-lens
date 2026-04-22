"""
Pydantic V2 schemas for request/response validation.
"""
from pydantic import BaseModel, EmailStr, Field, field_validator, ConfigDict
from typing import Optional, List, Any
from datetime import datetime



# ─── Auth ────────────────────────────────────────────────────────────
class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserResponse"


class LoginRequest(BaseModel):
    email: str
    password: str


class RegisterRequest(BaseModel):
    email: str
    password: str = Field(min_length=6)
    full_name: str
    tenant_name: Optional[str] = None


# ─── Users ───────────────────────────────────────────────────────────
class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    tenant_id: int
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


# ─── Tenants ─────────────────────────────────────────────────────────
class TenantResponse(BaseModel):
    id: int
    name: str
    slug: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ─── Properties ──────────────────────────────────────────────────────
class PropertyCreate(BaseModel):
    name: str
    address: Optional[str] = None
    city: Optional[str] = None
    province_state: Optional[str] = None
    postal_code: Optional[str] = None
    property_type: Optional[str] = "multi-family"
    unit_count: Optional[int] = 0


class PropertyUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    province_state: Optional[str] = None
    postal_code: Optional[str] = None
    property_type: Optional[str] = None
    unit_count: Optional[int] = None
    status: Optional[str] = None


class PropertyResponse(BaseModel):
    id: int
    tenant_id: int
    name: str
    address: Optional[str]
    city: Optional[str]
    province_state: Optional[str]
    postal_code: Optional[str]
    property_type: Optional[str]
    unit_count: int
    status: str
    created_at: datetime
    updated_at: datetime
    document_count: Optional[int] = 0
    deal_count: Optional[int] = 0

    model_config = ConfigDict(from_attributes=True)


# ─── Apartments ──────────────────────────────────────────────────────
class ApartmentCreate(BaseModel):
    unit_number: str
    unit_type: Optional[str] = "residential"
    floor: Optional[int] = None
    bedrooms: Optional[int] = None
    bathrooms: Optional[float] = None
    square_feet: Optional[float] = None
    monthly_rent: Optional[float] = None
    tenant_name: Optional[str] = None
    status: Optional[str] = "occupied"


class ApartmentResponse(BaseModel):
    id: int
    property_id: int
    unit_number: str
    unit_type: Optional[str]
    floor: Optional[int]
    bedrooms: Optional[int]
    bathrooms: Optional[float]
    square_feet: Optional[float]
    monthly_rent: Optional[float]
    tenant_name: Optional[str]
    status: str

    model_config = ConfigDict(from_attributes=True)


# ─── Documents ───────────────────────────────────────────────────────
class DocumentResponse(BaseModel):
    id: int
    property_id: int
    apartment_id: Optional[int]
    filename: str
    original_filename: str
    file_type: Optional[str]
    file_size: Optional[int]
    category: str
    subcategory: Optional[str]
    ocr_confidence: float
    status: str
    ai_category: Optional[str]
    ai_summary: Optional[str]
    deal_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DocumentDetailResponse(DocumentResponse):
    ocr_text: Optional[str]
    ocr_blocks: Optional[List[Any]]
    metadata_json: Optional[dict]
    file_path: str


class DocumentVerifyRequest(BaseModel):
    corrected_text: str


# ─── Deals ───────────────────────────────────────────────────────────
class DealResponse(BaseModel):
    id: int
    property_id: int
    deal_name: str
    stage: str
    purchase_price: Optional[float]
    asking_price: Optional[float]
    noi: Optional[float]
    cap_rate: Optional[float]
    gross_revenue: Optional[float]
    operating_expenses: Optional[float]
    cash_on_cash: Optional[float]
    price_per_unit: Optional[float]
    grm: Optional[float]
    ai_summary: Optional[str]
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime]

    model_config = ConfigDict(from_attributes=True)


class DealDetailResponse(DealResponse):
    structured_data: Optional[dict] = None
    lease_summary: Optional[list] = None
    expense_breakdown: Optional[dict] = None
    ai_report: Optional[str] = None
    pipeline_log: Optional[list] = None
    validation_errors: Optional[list] = None

    @field_validator('structured_data', 'expense_breakdown', mode='before')
    @classmethod
    def coerce_to_dict(cls, v: Any) -> dict:
        if isinstance(v, dict):
            return v
        if isinstance(v, str) and v.strip():
            try:
                import ast
                val = ast.literal_eval(v)
                if isinstance(val, dict):
                    return val
            except:
                try:
                    import json
                    val = json.loads(v)
                    if isinstance(val, dict):
                        return val
                except:
                    pass
        return {}

    @field_validator('lease_summary', 'pipeline_log', 'validation_errors', mode='before')
    @classmethod
    def coerce_to_list(cls, v: Any) -> list:
        if isinstance(v, list):
            return v
        if isinstance(v, str) and v.strip():
            try:
                import ast
                val = ast.literal_eval(v)
                if isinstance(val, list):
                    return val
            except:
                try:
                    import json
                    val = json.loads(v)
                    if isinstance(val, list):
                        return val
                except:
                    pass
        return []



# ─── Chat ────────────────────────────────────────────────────────────
class ChatRequest(BaseModel):
    message: str
    property_id: Optional[int] = None


class SourceCitation(BaseModel):
    doc_id: int
    filename: str
    page: Optional[int] = None
    score: float
    snippet: str


class ChatResponse(BaseModel):
    message: str
    response: str
    sources: List[SourceCitation] = []
    created_at: datetime


class ChatHistoryResponse(BaseModel):
    messages: List[ChatResponse]
    total: int


# ─── Search / Pagination ────────────────────────────────────────────
class PaginatedResponse(BaseModel):
    items: List[Any]
    total: int
    page: int
    page_size: int
    total_pages: int


class SearchQuery(BaseModel):
    q: str = ""
    category: Optional[str] = None
    status: Optional[str] = None
    property_id: Optional[int] = None
    page: int = 1
    page_size: int = 10


# ─── Dashboard Stats ────────────────────────────────────────────────
class DashboardStats(BaseModel):
    total_properties: int = 0
    total_documents: int = 0
    active_deals: int = 0
    pending_verification: int = 0
    total_portfolio_value: float = 0.0
    recent_deals: List[DealResponse] = []
