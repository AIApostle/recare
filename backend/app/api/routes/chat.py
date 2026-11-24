from fastapi import APIRouter, Depends
from app.schemas.chat import ChatRequest, ChatResponse
from app.agent.orchestrator import RecareAgentOrchestrator
from app.api.dependencies import get_orchestrator

router = APIRouter(prefix="/api/v1/chat", tags=["Chat"])

@router.post("", response_model=ChatResponse)
async def chat(
    payload: ChatRequest,
    orchestrator: RecareAgentOrchestrator = Depends(get_orchestrator),
):
    """Interactive chat and interface explanation grounded in active webpage context."""
    page_dict = payload.page_context.model_dump() if payload.page_context else None
    return await orchestrator.handle_chat(
        message=payload.message,
        page_context=page_dict,
        mode=payload.mode,
        simplified=payload.simplified_language,
    )
