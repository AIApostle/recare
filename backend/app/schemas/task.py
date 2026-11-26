from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from app.schemas.actions import BrowserAction, ActionResult
from app.schemas.safety import ApprovalRequest
from app.schemas.page_context import PageContext

class TaskState(str, Enum):
    IDLE = "IDLE"
    UNDERSTANDING = "UNDERSTANDING"
    PLANNING = "PLANNING"
    WAITING_FOR_ACTION = "WAITING_FOR_ACTION"
    EXECUTING = "EXECUTING"
    WAITING_FOR_USER_APPROVAL = "WAITING_FOR_USER_APPROVAL"
    WAITING_FOR_USER_INPUT = "WAITING_FOR_USER_INPUT"
    VERIFYING = "VERIFYING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"
    PAUSED = "PAUSED"

class PlanStep(BaseModel):
    step_number: int = Field(..., description="Sequential step index")
    description: str = Field(..., description="Human-readable step description")
    action_type: Optional[str] = Field(None, description="Action type if mapped to a browser action")
    status: str = Field("PENDING", description="PENDING, IN_PROGRESS, COMPLETED, FAILED, SKIPPED")
    risk_level: str = Field("LOW", description="LOW, MEDIUM, HIGH")

class TaskCreate(BaseModel):
    user_request: str = Field(..., min_length=1, description="Natural language goal or question")
    mode: str = Field("assist", description="Interaction mode: guide, assist, autonomous")
    page_context: Optional[PageContext] = Field(None, description="Initial active page context")

class TaskResponse(BaseModel):
    task_id: str = Field(..., description="Unique task identifier")
    state: TaskState = Field(..., description="Current state machine status")
    mode: str = Field(..., description="Active interaction mode")
    user_request: str = Field(..., description="Original user request")
    plan: Optional[List[PlanStep]] = Field(None, description="Structured execution plan steps")
    current_action: Optional[BrowserAction] = Field(None, description="Pending action for extension to execute")
    pending_approval: Optional[ApprovalRequest] = Field(None, description="Required approval prompt if blocked")
    message: Optional[str] = Field(None, description="Agent explanation or status update message for the user")
    completion_summary: Optional[str] = Field(None, description="Summary when task completes")
    error: Optional[str] = Field(None, description="Error explanation if task failed")
    generated_document: Optional[Dict[str, Any]] = Field(None, description="Synthesized research report or document file")
