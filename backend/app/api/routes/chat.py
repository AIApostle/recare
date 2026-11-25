from fastapi import APIRouter, Depends
from app.schemas.chat import ChatRequest, ChatResponse, TranscribeRequest, TranscribeResponse
from app.agent.orchestrator import RecareAgentOrchestrator
from app.agent.models import GeminiFallbackModel, get_model
from app.core.config import settings
from app.api.dependencies import get_orchestrator

router = APIRouter(prefix="/api/v1/chat", tags=["Chat"])

@router.post("", response_model=ChatResponse)
async def chat(
    payload: ChatRequest,
    orchestrator: RecareAgentOrchestrator = Depends(get_orchestrator),
):
    """Interactive chat and interface explanation grounded in active webpage context."""
    page_dict = payload.page_context.model_dump() if payload.page_context else None
    history = [m.model_dump() for m in (payload.conversation_history or [])]
    return await orchestrator.handle_chat(
        message=payload.message,
        page_context=page_dict,
        mode=payload.mode,
        simplified=payload.simplified_language,
        conversation_history=history,
    )


@router.post("/transcribe", response_model=TranscribeResponse)
async def transcribe_voice_clip(payload: TranscribeRequest):
    """Transcribe spoken audio chunks as a cloud fallback when browser SpeechRecognition fails."""
    model = get_model(settings.MODEL_PROVIDER, settings.MODEL_NAME)
    if isinstance(model, GeminiFallbackModel):
        transcript = await model.transcribe_audio(payload.audio_base64, payload.mime_type)
        return TranscribeResponse(transcript=transcript)
    return TranscribeResponse(transcript="")
