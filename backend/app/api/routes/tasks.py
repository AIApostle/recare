from typing import Optional, Dict, Any, List
import asyncio
import json
from fastapi import APIRouter, Depends, HTTPException, status, Query, Header, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse
from app.database.session import get_db
from app.schemas.task import TaskCreate, TaskResponse
from app.schemas.actions import ActionResult
from app.schemas.safety import ApprovalResponse
from app.schemas.page_context import PageContext
from app.services.task_service import TaskService
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/tasks", tags=["Tasks"])

class ResumeRequest(BaseModel):
    page_context: Optional[PageContext] = None

class ActionResultPayload(BaseModel):
    action_result: ActionResult
    page_context: Optional[PageContext] = None

class ApprovalPayload(BaseModel):
    approval: ApprovalResponse
    page_context: Optional[PageContext] = None

@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    payload: TaskCreate,
    x_device_id: Optional[str] = Header(None, alias="X-Device-Id"),
    x_tenant_id: Optional[str] = Header(None, alias="X-Tenant-Id"),
    db: AsyncSession = Depends(get_db),
):
    """Create and start a new Recare task with multi-tenant device isolation."""
    if not payload.tenant_id:
        payload.tenant_id = x_device_id or x_tenant_id
    return await TaskService.create_task(db, payload)

@router.get("", response_model=List[TaskResponse])
async def list_tasks(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    tenant_id: Optional[str] = Query(None),
    x_device_id: Optional[str] = Header(None, alias="X-Device-Id"),
    x_tenant_id: Optional[str] = Header(None, alias="X-Tenant-Id"),
    db: AsyncSession = Depends(get_db),
):
    """List recent tasks for history and auditing with multi-tenant isolation."""
    resolved_tenant = tenant_id or x_device_id or x_tenant_id
    return await TaskService.list_tasks(db, limit=limit, offset=offset, tenant_id=resolved_tenant)

@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: str,
    x_device_id: Optional[str] = Header(None, alias="X-Device-Id"),
    x_tenant_id: Optional[str] = Header(None, alias="X-Tenant-Id"),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve task state and progress with tenant check."""
    resolved_tenant = x_device_id or x_tenant_id
    task = await TaskService.get_task(db, task_id, tenant_id=resolved_tenant)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task

@router.get("/{task_id}/events")
async def task_events_stream(task_id: str, db: AsyncSession = Depends(get_db)):
    """Server-Sent Events (SSE) streaming endpoint for live task status and plan updates."""
    task = await TaskService.get_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    async def event_generator():
        # Yield initial state
        yield {
            "event": "task_state",
            "data": json.dumps({
                "task_id": task.task_id,
                "state": task.state.value,
                "user_request": task.user_request,
                "plan": [p.model_dump() for p in (task.plan or [])],
                "message": task.message,
            }),
        }
        # Yield heartbeat event
        yield {
            "event": "heartbeat",
            "data": json.dumps({"status": "active"}),
        }

    return EventSourceResponse(event_generator())

@router.post("/{task_id}/resume", response_model=TaskResponse)
async def resume_task(task_id: str, payload: ResumeRequest, db: AsyncSession = Depends(get_db)):
    """Resume a paused or in-progress task with updated page context."""
    ctx = payload.page_context.model_dump() if payload.page_context else None
    task = await TaskService.resume_task(db, task_id, ctx)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task

@router.post("/{task_id}/cancel", response_model=TaskResponse)
async def cancel_task(task_id: str, db: AsyncSession = Depends(get_db)):
    """Cancel and stop an active task immediately."""
    task = await TaskService.cancel_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task

@router.post("/{task_id}/approve", response_model=TaskResponse)
async def approve_task_action(task_id: str, payload: ApprovalPayload, db: AsyncSession = Depends(get_db)):
    """Submit user approval or rejection for a consequential action."""
    ctx = payload.page_context.model_dump() if payload.page_context else None
    task = await TaskService.handle_approval(db, task_id, payload.approval, ctx)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task

@router.post("/{task_id}/action-result", response_model=TaskResponse)
async def submit_action_result(task_id: str, payload: ActionResultPayload, db: AsyncSession = Depends(get_db)):
    """Receive action execution result from browser extension and step the agent."""
    ctx = payload.page_context.model_dump() if payload.page_context else None
    task = await TaskService.submit_action_result(db, task_id, payload.action_result, ctx)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task
