from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


class ConversationMessageSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    sender: str = Field(..., description="'user' or 'assistant'")
    text: str
    spokenText: Optional[str] = Field(None, alias="spoken_text")
    timestamp: str
    suggestedActions: Optional[List[str]] = None
    inferenceSource: Optional[str] = None
    modelUsed: Optional[str] = None


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
