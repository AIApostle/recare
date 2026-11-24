from typing import Any
from sqlalchemy import String, JSON
from sqlalchemy.orm import Mapped, mapped_column
from app.database.base import Base, TimestampMixin

class UserPreferenceModel(Base, TimestampMixin):
    __tablename__ = "user_preferences"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default="default_user")
    interaction_mode: Mapped[str] = mapped_column(String(20), default="assist")  # guide, assist, autonomous
    speech_rate: Mapped[float] = mapped_column(default=1.0)
    text_size: Mapped[str] = mapped_column(String(20), default="medium")  # small, medium, large, x-large
    voice_enabled: Mapped[bool] = mapped_column(default=False)
    voice_gender: Mapped[str] = mapped_column(String(20), default="neutral")
    simplified_language: Mapped[bool] = mapped_column(default=False)
    reduced_motion: Mapped[bool] = mapped_column(default=False)
    high_contrast: Mapped[bool] = mapped_column(default=False)
    auto_approve_low_risk: Mapped[bool] = mapped_column(default=True)
    custom_settings: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
