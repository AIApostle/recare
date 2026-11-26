from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.logging import logger
from app.database.session import init_db
from app.api.routes import health, tasks, chat, preferences, ws, conversations

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
app.include_router(conversations.router)

# Mount Test Bench Demonstration Pages
from pathlib import Path
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

static_path = Path(__file__).parent / "static"
if static_path.exists():
    app.mount("/testbench", StaticFiles(directory=str(static_path), html=True), name="testbench")
    app.mount("/test-bench", StaticFiles(directory=str(static_path), html=True), name="test-bench")

    @app.get("/", include_in_schema=False)
    async def serve_root_testbench():
        return FileResponse(static_path / "index.html")

    @app.get("/form", include_in_schema=False)
    @app.get("/form.html", include_in_schema=False)
    async def serve_form_page():
        return FileResponse(static_path / "form.html")

    @app.get("/navigation", include_in_schema=False)
    @app.get("/navigation.html", include_in_schema=False)
    async def serve_navigation_page():
        return FileResponse(static_path / "navigation.html")

    @app.get("/workflow", include_in_schema=False)
    @app.get("/workflow.html", include_in_schema=False)
    async def serve_workflow_page():
        return FileResponse(static_path / "workflow.html")

    @app.get("/dynamic", include_in_schema=False)
    @app.get("/dynamic.html", include_in_schema=False)
    async def serve_dynamic_page():
        return FileResponse(static_path / "dynamic.html")

    @app.get("/inaccessible", include_in_schema=False)
    @app.get("/inaccessible.html", include_in_schema=False)
    async def serve_inaccessible_page():
        return FileResponse(static_path / "inaccessible.html")

    @app.get("/injection", include_in_schema=False)
    @app.get("/injection.html", include_in_schema=False)
    async def serve_injection_page():
        return FileResponse(static_path / "injection.html")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=settings.DEBUG)
