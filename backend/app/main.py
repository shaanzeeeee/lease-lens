"""
FastAPI application entry point.
Mounts all routers, configures CORS, and initializes the database on startup.
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.database import init_db
from app.routers import auth, documents, assets, agents, chat, deals

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    logger.info("🚀 Starting Abelam Private Ledger API...")
    await init_db()
    logger.info("✅ Database initialized")

    # Create demo tenant + user if DB is empty
    await _seed_demo_data()

    yield
    logger.info("👋 Shutting down...")


app = FastAPI(
    title="Abelam Private Ledger",
    description="AI-powered Real Estate Acquisition Platform — Agentic RAG Workflow",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.error(f"Global exception caught: {exc}", exc_info=True)
    from fastapi.responses import JSONResponse
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error", "message": str(exc)},
    )

# Mount routers
app.include_router(auth.router)
app.include_router(documents.router)
app.include_router(assets.router, prefix="/api/properties")
app.include_router(agents.router)
app.include_router(chat.router)
app.include_router(deals.router)


@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "app": "Abelam Private Ledger",
        "version": "1.0.0",
    }


async def _seed_demo_data():
    """Create a demo tenant and admin user if the database is empty."""
    from app.database import async_session
    from app.models import Tenant, User, Property
    from app.auth import hash_password
    from sqlalchemy import select

    async with async_session() as db:
        # Check if any users exist
        result = await db.execute(select(User).limit(1))
        if result.scalar_one_or_none():
            return  # Data already exists

        logger.info("🌱 Seeding demo data...")

        # Create tenant
        tenant = Tenant(name="Abelam Realty", slug="abelam-realty")
        db.add(tenant)
        await db.flush()

        # Create admin user
        admin = User(
            tenant_id=tenant.id,
            email="admin@abelam.com",
            hashed_password=hash_password("admin123"),
            full_name="Admin User",
            role="admin",
        )
        db.add(admin)

        # Create demo property
        prop = Property(
            tenant_id=tenant.id,
            name="11587 Abelam Portfolio",
            address="11587 Abelam Street",
            city="Montreal",
            province_state="Quebec",
            postal_code="H1H 1H1",
            property_type="multi-family",
            unit_count=20,
        )
        db.add(prop)

        await db.commit()
        logger.info("✅ Demo data seeded: admin@abelam.com / admin123")


