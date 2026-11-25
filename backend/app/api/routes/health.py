from datetime import datetime, timezone
from fastapi import APIRouter
from app.core.config import settings
from app.database.session import async_session_maker
from sqlalchemy import text

router = APIRouter(tags=["Health"])

@router.api_route("/", methods=["GET", "HEAD"])
@router.api_route("/health", methods=["GET", "HEAD"])
@router.api_route("/healthz", methods=["GET", "HEAD"])
@router.api_route("/api/v1/health", methods=["GET", "HEAD"])
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
        "model_name": settings.MODEL_NAME,
        "gemini_configured": bool(settings.GEMINI_API_KEY and settings.GEMINI_API_KEY.strip()),
        "database": db_status,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
