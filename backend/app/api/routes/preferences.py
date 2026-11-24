from typing import Any, Dict
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database.session import get_db
from app.models.user import UserPreferenceModel
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/v1/user/preferences", tags=["Preferences"])

class UserPreferencesSchema(BaseModel):
    interaction_mode: str = Field("assist", description="guide, assist, autonomous")
    speech_rate: float = Field(1.0, ge=0.5, le=2.0)
    text_size: str = Field("medium", description="small, medium, large, x-large")
    voice_enabled: bool = False
    voice_gender: str = "neutral"
    simplified_language: bool = False
    reduced_motion: bool = False
    high_contrast: bool = False
    auto_approve_low_risk: bool = True
    custom_settings: Dict[str, Any] = Field(default_factory=dict)

@router.get("", response_model=UserPreferencesSchema)
async def get_preferences(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UserPreferenceModel).where(UserPreferenceModel.id == "default_user"))
    prefs = result.scalar_one_or_none()
    if not prefs:
        prefs = UserPreferenceModel(id="default_user")
        db.add(prefs)
        await db.commit()
    return UserPreferencesSchema(
        interaction_mode=prefs.interaction_mode,
        speech_rate=prefs.speech_rate,
        text_size=prefs.text_size,
        voice_enabled=prefs.voice_enabled,
        voice_gender=prefs.voice_gender,
        simplified_language=prefs.simplified_language,
        reduced_motion=prefs.reduced_motion,
        high_contrast=prefs.high_contrast,
        auto_approve_low_risk=prefs.auto_approve_low_risk,
        custom_settings=prefs.custom_settings or {},
    )

@router.put("", response_model=UserPreferencesSchema)
async def update_preferences(payload: UserPreferencesSchema, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UserPreferenceModel).where(UserPreferenceModel.id == "default_user"))
    prefs = result.scalar_one_or_none()
    if not prefs:
        prefs = UserPreferenceModel(id="default_user")
        db.add(prefs)
    
    prefs.interaction_mode = payload.interaction_mode
    prefs.speech_rate = payload.speech_rate
    prefs.text_size = payload.text_size
    prefs.voice_enabled = payload.voice_enabled
    prefs.voice_gender = payload.voice_gender
    prefs.simplified_language = payload.simplified_language
    prefs.reduced_motion = payload.reduced_motion
    prefs.high_contrast = payload.high_contrast
    prefs.auto_approve_low_risk = payload.auto_approve_low_risk
    prefs.custom_settings = payload.custom_settings

    await db.commit()
    return payload
