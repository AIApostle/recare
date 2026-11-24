import os
import httpx
from typing import Optional, Any, AsyncIterable, List, Dict
from strands.models.model import Model
from strands.models import BedrockModel
from strands.types.streaming import (
    StreamEvent,
    MessageStartEvent,
    ContentBlockStartEvent,
    ContentBlockDeltaEvent,
    ContentBlockDeltaText,
    ContentBlockStopEvent,
    MessageStopEvent,
)
from strands.types.content import Message
from app.core.config import settings
from app.core.logging import logger

GEMINI_FALLBACK_MODELS = [
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash",
    "gemini-1.5-flash",
    "gemini-1.5-pro",
]

def _extract_content(msg: Any) -> str:
    if isinstance(msg, dict):
        return str(msg.get("content", ""))
    return str(getattr(msg, "content", msg or ""))

class RecareMockModel(Model):
    """Deterministic Mock Model for testing and offline development without paid API keys."""

    def __init__(self, model_id: str = "recare-mock-v1"):
        self.model_id = model_id
        super().__init__()

    def get_config(self) -> dict[str, Any]:
        return {"model_id": self.model_id}

    def update_config(self, **kwargs: Any) -> None:
        pass

    async def structured_output(self, *args: Any, **kwargs: Any) -> Any:
        return {}

    async def stream(
        self,
        messages: List[Message],
        tool_specs: Optional[List[Any]] = None,
        system_prompt: Optional[str] = None,
        **kwargs: Any,
    ) -> AsyncIterable[StreamEvent]:
        """Stream simulated agent reasoning events."""
        last_msg = _extract_content(messages[-1]) if messages else "Hello"
        text_content = f"Recare Assistant analyzed the request: '{last_msg}'."

        yield MessageStartEvent(role="assistant")
        yield ContentBlockStartEvent(index=0)
        yield ContentBlockDeltaEvent(
            index=0,
            delta=ContentBlockDeltaText(text=text_content),
        )
        yield ContentBlockStopEvent(index=0)
        yield MessageStopEvent(stop_reason="end_turn")


class GeminiFallbackModel(Model):
    """
    Robust Gemini Model with multi-model fallback chain.
    If the primary model is unavailable, rate-limited, or overloaded,
    it automatically cycles down the fallback chain:
    gemini-2.5-flash-lite -> gemini-2.5-flash -> gemini-1.5-flash -> gemini-1.5-pro -> mock
    """

    def __init__(self, model_id: str = "gemini-2.5-flash-lite"):
        self.model_id = model_id
        super().__init__()

    def get_config(self) -> dict[str, Any]:
        return {"model_id": self.model_id}

    def update_config(self, **kwargs: Any) -> None:
        if "model_id" in kwargs:
            self.model_id = kwargs["model_id"]

    async def structured_output(self, *args: Any, **kwargs: Any) -> Any:
        return {}

    async def stream(
        self,
        messages: List[Message],
        tool_specs: Optional[List[Any]] = None,
        system_prompt: Optional[str] = None,
        **kwargs: Any,
    ) -> AsyncIterable[StreamEvent]:
        api_key = settings.GEMINI_API_KEY.strip() if settings.GEMINI_API_KEY else ""
        last_msg = _extract_content(messages[-1]) if messages else "Hello"

        # Build candidate chain starting with primary requested model
        candidates = [self.model_id] + [m for m in GEMINI_FALLBACK_MODELS if m != self.model_id]

        text_result = None
        model_used = None

        if api_key:
            async with httpx.AsyncClient(timeout=25.0) as client:
                for candidate in candidates:
                    url = f"https://generativelanguage.googleapis.com/v1beta/models/{candidate}:generateContent?key={api_key}"
                    payload: Dict[str, Any] = {
                        "contents": [{"parts": [{"text": str(last_msg)}]}],
                        "generationConfig": {"temperature": 0.2, "maxOutputTokens": 1024},
                    }
                    if system_prompt:
                        payload["systemInstruction"] = {"parts": [{"text": system_prompt}]}

                    try:
                        res = await client.post(url, json=payload)
                        if res.status_code == 200:
                            data = res.json()
                            parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
                            if parts and "text" in parts[0]:
                                text_result = parts[0]["text"]
                                model_used = candidate
                                logger.info(f"[Recare] Successfully inferred using {candidate}")
                                break
                        else:
                            logger.warning(f"[Recare] Model {candidate} returned HTTP {res.status_code}. Attempting fallback...")
                    except Exception as e:
                        logger.warning(f"[Recare] Error connecting to {candidate}: {e}. Attempting fallback...")

        # If all Gemini models fail or no API key is provided
        if not text_result:
            model_used = "Unavailable"
            text_result = "AI model is currently not available."

        yield MessageStartEvent(role="assistant")
        yield ContentBlockStartEvent(index=0)
        yield ContentBlockDeltaEvent(
            index=0,
            delta=ContentBlockDeltaText(text=text_result),
        )
        yield ContentBlockStopEvent(index=0)
        yield MessageStopEvent(stop_reason="end_turn")


def get_model(provider: Optional[str] = None, model_name: Optional[str] = None) -> Model:
    """Factory to retrieve configured model provider with automatic fallbacks."""
    prov = (provider or settings.MODEL_PROVIDER or "mock").lower()
    m_name = model_name or settings.MODEL_NAME or "gemini-2.5-flash-lite"

    if prov == "gemini":
        logger.info(f"Using Gemini Fallback Model provider (Primary: {m_name})")
        return GeminiFallbackModel(model_id=m_name)

    if prov == "bedrock":
        logger.info(f"Using AWS Bedrock provider (Model: {m_name})")
        return BedrockModel(model_id=m_name)

    if prov == "mock":
        return RecareMockModel(model_id=m_name)

    logger.info(f"Selected model provider '{prov}' with model '{m_name}'")
    return GeminiFallbackModel(model_id=m_name)
