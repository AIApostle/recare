from enum import Enum
from typing import Optional, List
from pydantic import BaseModel, Field

class RiskLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"

class ApprovalRequest(BaseModel):
    approval_id: str = Field(..., description="Unique approval identifier")
    task_id: str = Field(..., description="Task requesting approval")
    action_id: str = Field(..., description="Proposed action ID")
    action_type: str = Field(..., description="Type of action e.g. CLICK")
    risk_level: RiskLevel = Field(..., description="Action risk classification")
    target_description: str = Field(..., description="User-friendly description of affected control/domain")
    reason: str = Field(..., description="Why approval is required by policy")
    affected_domain: Optional[str] = Field(None, description="Website domain being affected")
    data_payload: Optional[str] = Field(None, description="Sensitive payload being submitted, if any")

class ApprovalResponse(BaseModel):
    approval_id: str = Field(..., description="Approval ID")
    approved: bool = Field(..., description="True if approved, False if rejected")
    note: Optional[str] = Field(None, description="Optional user note or feedback")
