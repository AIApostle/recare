from fastapi import APIRouter
from app.core.config import settings
from app.database.session import async_session_maker
from sqlalchemy import text

router = APIRouter(tags=["Health"])

@router.get("/")
@router.get("/health")
@router.get("/api/v1/health")
async def health_check():
    db_status = "connected"
    try:
        async with async_session_maker() as session:
            await session.execute(text("SELECT 1"))
    except Exception as e:
        db_status = f"unreachable: {str(e)}"

    return {
        "status": "healthy" if "unreachable" not in db_status else "degraded",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
        "model_provider": settings.MODEL_PROVIDER,
        "database": db_status,
    }
