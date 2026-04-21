import asyncio
from app.database import async_session
from app.models import Property, Tenant
from sqlalchemy import select

async def main():
    async with async_session() as session:
        # Properties
        result = await session.execute(select(Property))
        properties = result.scalars().all()
        print(f"Properties found: {[p.id for p in properties]}")
        
        # Tenants
        result = await session.execute(select(Tenant))
        tenants = result.scalars().all()
        print(f"Tenants found: {[(t.id, t.name) for t in tenants]}")

if __name__ == "__main__":
    asyncio.run(main())
