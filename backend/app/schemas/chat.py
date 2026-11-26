from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from app.schemas.page_context import PageContext

class ChatMessage(BaseModel):
    role: str = Field(..., description="user, assistant, or system")
    content: str = Field(..., description="Message text")
    timestamp: Optional[str] = Field(None)

class ChatRequest(BaseModel):
    message: str = Field(..., description="User message or question")
    page_context: Optional[PageContext] = Field(None, description="Active page context")
    mode: str = Field("guide", description="guide, assist, autonomous")
    simplified_language: bool = Field(False, description="Whether to simplify explanations for cognitive accessibility")
    conversation_history: Optional[List[ChatMessage]] = Field(default_factory=list)
    image_base64: Optional[str] = Field(None, description="Base64 encoded image or attachment")

class HighlightTarget(BaseModel):
    element_id: Optional[str] = Field(None)
    selector: Optional[str] = Field(None)
    accessible_name: Optional[str] = Field(None)
    label: Optional[str] = Field(None)

class ChatResponse(BaseModel):
    reply: str = Field(..., description="Assistant response text")
    spoken_summary: Optional[str] = Field(None, description="Concise text optimized for text-to-speech audio")
    highlight_targets: List[HighlightTarget] = Field(default_factory=list, description="Elements to visually highlight")
    suggested_actions: List[str] = Field(default_factory=list, description="Recommended next prompts/actions")
    suggested_task: Optional[str] = Field(None, description="Actionable task proposal if user wants execution")


class TranscribeRequest(BaseModel):
    audio_base64: str = Field(..., description="Base64-encoded audio clip (e.g. audio/webm)")
    mime_type: str = Field("audio/webm", description="Audio MIME type")


class TranscribeResponse(BaseModel):
    transcript: str = Field("", description="Transcribed spoken text")
