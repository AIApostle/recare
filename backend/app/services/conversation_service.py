from __future__ import annotations
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload
from app.models.conversation import ConversationModel, ConversationMessageModel
from app.schemas.conversation import ConversationResponse, ConversationMessageSchema, ConversationSyncRequest
from app.core.logging import logger


def _model_to_response(conv: ConversationModel) -> ConversationResponse:
    """Convert a SQLAlchemy ConversationModel to a Pydantic response."""
    msgs = sorted(conv.messages, key=lambda m: m.seq) if conv.messages else []
    return ConversationResponse(
        id=conv.id,
        title=conv.title,
        domain=conv.domain,
        url=conv.url,
        createdAt=conv.created_at.isoformat() if conv.created_at else "",
        updatedAt=conv.updated_at.isoformat() if conv.updated_at else "",
        messages=[
            ConversationMessageSchema(
                id=m.id,
                sender=m.sender,
                text=m.text,
                spoken_text=m.spoken_text,
                timestamp=m.timestamp,
                suggestedActions=m.metadata_json.get("suggestedActions") if m.metadata_json else None,
                inferenceSource=m.metadata_json.get("inferenceSource") if m.metadata_json else None,
                modelUsed=m.metadata_json.get("modelUsed") if m.metadata_json else None,
            )
            for m in msgs
        ],
    )


class ConversationService:
    @staticmethod
    async def list_conversations(db: AsyncSession, device_id: str, limit: int = 50) -> List[ConversationResponse]:
        result = await db.execute(
            select(ConversationModel)
            .where(ConversationModel.device_id == device_id)
            .options(selectinload(ConversationModel.messages))
            .order_by(ConversationModel.updated_at.desc())
            .limit(limit)
        )
        convs = result.scalars().unique().all()
        return [_model_to_response(c) for c in convs]

    @staticmethod
    async def get_conversation(db: AsyncSession, device_id: str, conversation_id: str) -> Optional[ConversationResponse]:
        result = await db.execute(
            select(ConversationModel)
            .where(ConversationModel.id == conversation_id, ConversationModel.device_id == device_id)
            .options(selectinload(ConversationModel.messages))
        )
        conv = result.scalar_one_or_none()
        if not conv:
            return None
        return _model_to_response(conv)

    @staticmethod
    async def sync_conversation(db: AsyncSession, device_id: str, payload: ConversationSyncRequest) -> ConversationResponse:
        """Upsert a full conversation (insert or replace messages)."""
        result = await db.execute(
            select(ConversationModel)
            .where(ConversationModel.id == payload.id, ConversationModel.device_id == device_id)
            .options(selectinload(ConversationModel.messages))
        )
        conv = result.scalar_one_or_none()

        if conv:
            conv.title = payload.title
            conv.domain = payload.domain
            conv.url = payload.url
            # Clear existing messages and re-insert
            await db.execute(
                delete(ConversationMessageModel).where(ConversationMessageModel.conversation_id == conv.id)
            )
            await db.flush()
        else:
            conv = ConversationModel(
                id=payload.id,
                device_id=device_id,
                title=payload.title,
                domain=payload.domain,
                url=payload.url,
            )
            db.add(conv)
            await db.flush()

        for idx, msg in enumerate(payload.messages):
            meta = {}
            if msg.suggestedActions:
                meta["suggestedActions"] = msg.suggestedActions
            if msg.inferenceSource:
                meta["inferenceSource"] = msg.inferenceSource
            if msg.modelUsed:
                meta["modelUsed"] = msg.modelUsed

            db.add(ConversationMessageModel(
                id=msg.id,
                conversation_id=conv.id,
                seq=idx,
                sender=msg.sender,
                text=msg.text,
                spoken_text=msg.spokenText,
                timestamp=msg.timestamp,
                metadata_json=meta if meta else None,
            ))

        await db.commit()
        await db.refresh(conv)

        # Re-load with messages
        result2 = await db.execute(
            select(ConversationModel)
            .where(ConversationModel.id == conv.id)
            .options(selectinload(ConversationModel.messages))
        )
        conv = result2.scalar_one()
        return _model_to_response(conv)

    @staticmethod
    async def delete_conversation(db: AsyncSession, device_id: str, conversation_id: str) -> bool:
        result = await db.execute(
            select(ConversationModel)
            .where(ConversationModel.id == conversation_id, ConversationModel.device_id == device_id)
        )
        conv = result.scalar_one_or_none()
        if not conv:
            return False
        await db.delete(conv)
        await db.commit()
        return True
