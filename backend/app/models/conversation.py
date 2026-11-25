from typing import Optional, List, Any
import uuid
from sqlalchemy import String, Text, JSON, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import Base, TimestampMixin


class ConversationModel(Base, TimestampMixin):
    """Persistent conversation thread owned by a device/user."""

    __tablename__ = "conversations"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: f"conv_{uuid.uuid4().hex[:12]}")
    device_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False, default="New conversation")
    domain: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    url: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True)

    messages: Mapped[List["ConversationMessageModel"]] = relationship(
        "ConversationMessageModel",
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="ConversationMessageModel.seq",
    )


class ConversationMessageModel(Base):
    """Individual chat message within a conversation."""

    __tablename__ = "conversation_messages"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: f"msg_{uuid.uuid4().hex[:12]}")
    conversation_id: Mapped[str] = mapped_column(String(64), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    seq: Mapped[int] = mapped_column(nullable=False)
    sender: Mapped[str] = mapped_column(String(20), nullable=False)  # 'user' | 'assistant'
    text: Mapped[str] = mapped_column(Text, nullable=False)
    spoken_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    timestamp: Mapped[str] = mapped_column(String(50), nullable=False)
    metadata_json: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, nullable=True)

    conversation: Mapped["ConversationModel"] = relationship("ConversationModel", back_populates="messages")
