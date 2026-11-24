import uuid
from typing import Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.task import TaskModel, ActionStepModel, ApprovalRecordModel
from app.schemas.task import TaskCreate, TaskResponse, TaskState
from app.schemas.actions import ActionResult
from app.schemas.safety import ApprovalResponse
from app.agent.orchestrator import RecareAgentOrchestrator
from app.core.logging import logger

orchestrator = RecareAgentOrchestrator()

class TaskService:
    @staticmethod
    async def create_task(db: AsyncSession, payload: TaskCreate) -> TaskResponse:
        task_id = str(uuid.uuid4())
        page_dict = payload.page_context.model_dump() if payload.page_context else {}
        
        # Run through orchestrator for initial plan and possible action
        response = await orchestrator.step_task(
            task_id=task_id,
            user_request=payload.user_request,
            mode=payload.mode,
            page_context=page_dict,
        )

        task_record = TaskModel(
            id=task_id,
            user_request=payload.user_request,
            state=response.state.value,
            mode=payload.mode,
            current_url=page_dict.get("url"),
            current_domain=page_dict.get("domain"),
            page_title=page_dict.get("title"),
            plan=[p.model_dump() for p in (response.plan or [])],
            completion_summary=response.completion_summary,
            error_message=response.error,
        )
        db.add(task_record)
        await db.commit()
        
        return response

    @staticmethod
    async def list_tasks(db: AsyncSession, limit: int = 20, offset: int = 0) -> List[TaskResponse]:
        result = await db.execute(
            select(TaskModel).order_by(TaskModel.created_at.desc()).limit(limit).offset(offset)
        )
        tasks = result.scalars().all()
        return [
            TaskResponse(
                task_id=t.id,
                state=TaskState(t.state),
                mode=t.mode,
                user_request=t.user_request,
                plan=t.plan,
                completion_summary=t.completion_summary,
                error=t.error_message,
            )
            for t in tasks
        ]

    @staticmethod
    async def get_task(db: AsyncSession, task_id: str) -> Optional[TaskResponse]:
        result = await db.execute(select(TaskModel).where(TaskModel.id == task_id))
        task = result.scalar_one_or_none()
        if not task:
            return None
            
        return TaskResponse(
            task_id=task.id,
            state=TaskState(task.state),
            mode=task.mode,
            user_request=task.user_request,
            plan=task.plan,
            completion_summary=task.completion_summary,
            error=task.error_message,
        )

    @staticmethod
    async def cancel_task(db: AsyncSession, task_id: str) -> Optional[TaskResponse]:
        result = await db.execute(select(TaskModel).where(TaskModel.id == task_id))
        task = result.scalar_one_or_none()
        if not task:
            return None
            
        task.state = TaskState.CANCELLED.value
        task.is_active = False
        await db.commit()
        
        return TaskResponse(
            task_id=task.id,
            state=TaskState.CANCELLED,
            mode=task.mode,
            user_request=task.user_request,
            plan=task.plan,
            message="Task was stopped by user.",
        )

    @staticmethod
    async def resume_task(db: AsyncSession, task_id: str, page_context: Optional[Dict[str, Any]] = None) -> Optional[TaskResponse]:
        result = await db.execute(select(TaskModel).where(TaskModel.id == task_id))
        task = result.scalar_one_or_none()
        if not task:
            return None
            
        response = await orchestrator.step_task(
            task_id=task.id,
            user_request=task.user_request,
            mode=task.mode,
            page_context=page_context,
        )
        
        task.state = response.state.value
        if response.plan:
            task.plan = [p.model_dump() for p in response.plan]
        await db.commit()
        return response

    @staticmethod
    async def handle_approval(db: AsyncSession, task_id: str, approval: ApprovalResponse, page_context: Optional[Dict[str, Any]] = None) -> Optional[TaskResponse]:
        result = await db.execute(select(TaskModel).where(TaskModel.id == task_id))
        task = result.scalar_one_or_none()
        if not task:
            return None
            
        response = await orchestrator.step_task(
            task_id=task.id,
            user_request=task.user_request,
            mode=task.mode,
            page_context=page_context,
            approved=approval.approved,
        )
        
        task.state = response.state.value
        await db.commit()
        return response

    @staticmethod
    async def submit_action_result(db: AsyncSession, task_id: str, action_result: ActionResult, page_context: Optional[Dict[str, Any]] = None) -> Optional[TaskResponse]:
        result = await db.execute(select(TaskModel).where(TaskModel.id == task_id))
        task = result.scalar_one_or_none()
        if not task:
            return None
            
        response = await orchestrator.step_task(
            task_id=task.id,
            user_request=task.user_request,
            mode=task.mode,
            page_context=page_context,
            last_action_result=action_result,
        )
        
        task.state = response.state.value
        task.completion_summary = response.completion_summary
        task.error_message = response.error
        await db.commit()
        return response
