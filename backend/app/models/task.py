from typing import Optional, List, Any
import uuid
from sqlalchemy import String, Text, Boolean, JSON, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import Base, TimestampMixin

class TaskModel(Base, TimestampMixin):
    __tablename__ = "tasks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    user_request: Mapped[str] = mapped_column(Text, nullable=False)
    state: Mapped[str] = mapped_column(String(50), nullable=False, default="IDLE")
    mode: Mapped[str] = mapped_column(String(20), nullable=False, default="assist")  # guide, assist, autonomous
    current_url: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True)
    current_domain: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    page_title: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    plan: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    completion_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    action_steps: Mapped[List["ActionStepModel"]] = relationship(
        "ActionStepModel", back_populates="task", cascade="all, delete-orphan", order_by="ActionStepModel.step_number"
    )
    approvals: Mapped[List["ApprovalRecordModel"]] = relationship(
        "ApprovalRecordModel", back_populates="task", cascade="all, delete-orphan"
    )

class ActionStepModel(Base, TimestampMixin):
    __tablename__ = "action_steps"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    task_id: Mapped[str] = mapped_column(String(36), ForeignKey("tasks.id"), nullable=False)
    step_number: Mapped[int] = mapped_column(nullable=False)
    action_type: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    target_selector: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    target_element_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    action_payload: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="PENDING")  # PENDING, EXECUTING, SUCCESS, FAILED, SKIPPED
    risk_level: Mapped[str] = mapped_column(String(20), default="LOW")
    result: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, nullable=True)

    task: Mapped["TaskModel"] = relationship("TaskModel", back_populates="action_steps")

class ApprovalRecordModel(Base, TimestampMixin):
    __tablename__ = "approval_records"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    task_id: Mapped[str] = mapped_column(String(36), ForeignKey("tasks.id"), nullable=False)
    action_id: Mapped[str] = mapped_column(String(36), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    action_summary: Mapped[str] = mapped_column(Text, nullable=False)
    risk_level: Mapped[str] = mapped_column(String(20), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="PENDING")  # PENDING, APPROVED, REJECTED
    user_response_at: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    task: Mapped["TaskModel"] = relationship("TaskModel", back_populates="approvals")
