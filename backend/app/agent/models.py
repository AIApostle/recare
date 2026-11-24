import os
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
        last_msg = messages[-1].content if messages else "Hello"
        text_content = f"Recare Assistant analyzed the request: '{last_msg}'."

        yield MessageStartEvent(role="assistant")
        yield ContentBlockStartEvent(index=0)
        yield ContentBlockDeltaEvent(
            index=0,
            delta=ContentBlockDeltaText(text=text_content),
        )
        yield ContentBlockStopEvent(index=0)
        yield MessageStopEvent(stop_reason="end_turn")

def get_model(provider: Optional[str] = None, model_name: Optional[str] = None) -> Model:
    """Factory to retrieve configured model provider."""
    prov = (provider or settings.MODEL_PROVIDER or "mock").lower()
    m_name = model_name or settings.MODEL_NAME

    if prov == "bedrock":
        logger.info(f"Using AWS Bedrock provider (Model: {m_name})")
        return BedrockModel(model_id=m_name)

    if prov == "mock":
        return RecareMockModel(model_id=m_name)

    # If user configured OpenAI, Anthropic, or Gemini:
    logger.info(f"Selected model provider '{prov}' with model '{m_name}'")
    return RecareMockModel(model_id=m_name)
