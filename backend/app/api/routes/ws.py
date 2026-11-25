import json
import uuid
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.database.session import async_session_maker
from app.schemas.task import TaskCreate
from app.schemas.actions import ActionResult
from app.schemas.safety import ApprovalResponse
from app.schemas.page_context import PageContext
from app.services.task_service import TaskService, orchestrator
from app.agent.models import GeminiFallbackModel, get_model
from app.core.config import settings
from app.core.logging import logger

router = APIRouter(tags=["WebSocket"])


@router.websocket("/api/v1/ws")
async def websocket_endpoint(websocket: WebSocket):
    """Low-latency bidirectional WebSocket channel for chat, task stepping, and voice transcription."""
    await websocket.accept()
    logger.info("[Recare WS] Client connected.")

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "error": "Invalid JSON frame"})
                continue

            msg_type = msg.get("type")
            request_id = msg.get("request_id") or uuid.uuid4().hex

            if msg_type == "ping":
                await websocket.send_json({"type": "pong", "request_id": request_id})
                continue

            try:
                if msg_type == "chat":
                    await websocket.send_json({
                        "type": "status",
                        "request_id": request_id,
                        "text": "Thinking...",
                    })
                    res = await orchestrator.handle_chat(
                        message=msg.get("message", ""),
                        page_context=msg.get("page_context"),
                        mode=msg.get("mode", "guide"),
                        simplified=bool(msg.get("simplified_language", False)),
                        conversation_history=msg.get("conversation_history") or [],
                    )
                    await websocket.send_json({
                        "type": "chat_response",
                        "request_id": request_id,
                        "data": res.model_dump(),
                    })

                elif msg_type == "task_start":
                    await websocket.send_json({
                        "type": "status",
                        "request_id": request_id,
                        "text": "Planning browser action...",
                    })
                    async with async_session_maker() as db:
                        page_raw = msg.get("page_context")
                        payload = TaskCreate(
                            user_request=msg.get("user_request", ""),
                            mode=msg.get("mode", "assist"),
                            page_context=PageContext(**page_raw) if page_raw else None,
                        )
                        res = await TaskService.create_task(db, payload)
                    await websocket.send_json({
                        "type": "task_response",
                        "request_id": request_id,
                        "data": res.model_dump(),
                    })

                elif msg_type == "task_action_result":
                    async with async_session_maker() as db:
                        res = await TaskService.submit_action_result(
                            db,
                            task_id=msg["task_id"],
                            action_result=ActionResult(**msg["action_result"]),
                            page_context=msg.get("page_context"),
                        )
                    if not res:
                        await websocket.send_json({
                            "type": "error",
                            "request_id": request_id,
                            "error": "Task not found",
                        })
                    else:
                        await websocket.send_json({
                            "type": "task_response",
                            "request_id": request_id,
                            "data": res.model_dump(),
                        })

                elif msg_type == "task_approval":
                    async with async_session_maker() as db:
                        res = await TaskService.handle_approval(
                            db,
                            task_id=msg["task_id"],
                            approval=ApprovalResponse(**msg["approval"]),
                            page_context=msg.get("page_context"),
                        )
                    if not res:
                        await websocket.send_json({
                            "type": "error",
                            "request_id": request_id,
                            "error": "Task not found",
                        })
                    else:
                        await websocket.send_json({
                            "type": "task_response",
                            "request_id": request_id,
                            "data": res.model_dump(),
                        })

                elif msg_type == "transcribe":
                    model = get_model(settings.MODEL_PROVIDER, settings.MODEL_NAME)
                    transcript = ""
                    if isinstance(model, GeminiFallbackModel):
                        transcript = await model.transcribe_audio(
                            msg.get("audio_base64", ""),
                            msg.get("mime_type", "audio/webm"),
                        )
                    await websocket.send_json({
                        "type": "transcribe_response",
                        "request_id": request_id,
                        "data": {"transcript": transcript},
                    })

                else:
                    await websocket.send_json({
                        "type": "error",
                        "request_id": request_id,
                        "error": f"Unknown message type: {msg_type}",
                    })

            except Exception as exc:
                logger.warning(f"[Recare WS] Handler error for {msg_type}: {exc}")
                await websocket.send_json({
                    "type": "error",
                    "request_id": request_id,
                    "error": str(exc),
                })

    except WebSocketDisconnect:
        logger.info("[Recare WS] Client disconnected.")
