from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Header, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.database.session import get_db
from app.schemas.conversation import ConversationResponse, ConversationSyncRequest
from app.services.conversation_service import ConversationService

router = APIRouter(prefix="/api/v1/conversations", tags=["Conversations"])

# Default fallback device id when header is omitted (dev convenience)
_DEFAULT_DEVICE = "anonymous"


def _resolve_device_id(x_device_id: Optional[str] = Header(None, alias="X-Device-Id")) -> str:
    """Extract the per-device identity from the X-Device-Id header."""
    return x_device_id.strip() if x_device_id else _DEFAULT_DEVICE


@router.get("", response_model=List[ConversationResponse])
async def list_conversations(
    limit: int = Query(50, ge=1, le=200),
    device_id: str = Depends(_resolve_device_id),
    db: AsyncSession = Depends(get_db),
):
    """List all conversations for this device, newest first."""
    return await ConversationService.list_conversations(db, device_id, limit)


@router.get("/{conversation_id}", response_model=ConversationResponse)
async def get_conversation(
    conversation_id: str,
    device_id: str = Depends(_resolve_device_id),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve a single conversation with all messages."""
    conv = await ConversationService.get_conversation(db, device_id, conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv


@router.put("", response_model=ConversationResponse)
async def sync_conversation(
    payload: ConversationSyncRequest,
    device_id: str = Depends(_resolve_device_id),
    db: AsyncSession = Depends(get_db),
):
    """Upsert (create or update) a full conversation with its messages.

    The extension calls this every time messages change, sending the full conversation.
    Server-side isolation is by X-Device-Id header.
    """
    return await ConversationService.sync_conversation(db, device_id, payload)


@router.delete("/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_conversation(
    conversation_id: str,
    device_id: str = Depends(_resolve_device_id),
    db: AsyncSession = Depends(get_db),
):
    """Delete a conversation and all its messages."""
    deleted = await ConversationService.delete_conversation(db, device_id, conversation_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Conversation not found")
