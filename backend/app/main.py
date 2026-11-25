from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.logging import logger
from app.database.session import init_db
from app.api.routes import health, tasks, chat, preferences, ws

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing Recare Database...")
    await init_db()
    logger.info("Recare Backend initialized and ready.")
    yield
    logger.info("Recare Backend shutting down...")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Recare AI Agent Backend for Webpage Understanding, Task Planning & Guided Execution",
    lifespan=lifespan,
)

# CORS Middleware for Chrome Extension, Vercel frontends, and local Web Dashboards
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"chrome-extension://.*|http://localhost:.*|http://127.0.0.1:.*|https://.*\.vercel\.app|https://.*\.onrender\.com|https://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers
app.include_router(health.router)
app.include_router(tasks.router)
app.include_router(chat.router)
app.include_router(preferences.router)
app.include_router(ws.router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=settings.DEBUG)
