from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class ConversationMessageSchema(BaseModel):
    id: str
    sender: str = Field(..., description="'user' or 'assistant'")
    text: str
    spokenText: Optional[str] = Field(None, alias="spoken_text")
    timestamp: str
    suggestedActions: Optional[List[str]] = None
    inferenceSource: Optional[str] = None
    modelUsed: Optional[str] = None

    class Config:
        populate_by_name = True


class ConversationResponse(BaseModel):
    id: str
    title: str
    domain: Optional[str] = None
    url: Optional[str] = None
    createdAt: str
    updatedAt: str
    messages: List[ConversationMessageSchema] = Field(default_factory=list)


class ConversationSyncRequest(BaseModel):
    """Full conversation payload sent by the extension for server-side persistence."""
    id: str
    title: str
    domain: Optional[str] = None
    url: Optional[str] = None
    createdAt: str
    updatedAt: str
    messages: List[ConversationMessageSchema] = Field(default_factory=list)
