from enum import Enum
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field

class ActionType(str, Enum):
    CLICK = "CLICK"
    TYPE = "TYPE"
    FILL = "FILL"
    SELECT = "SELECT"
    SCROLL = "SCROLL"
    NAVIGATE = "NAVIGATE"
    HIGHLIGHT = "HIGHLIGHT"
    READ = "READ"
    WAIT = "WAIT"
    PRESS_KEY = "PRESS_KEY"
    REQUEST_FILE_UPLOAD = "REQUEST_FILE_UPLOAD"

class BrowserActionTarget(BaseModel):
    element_id: Optional[str] = Field(None, description="Page-scoped element ID e.g. elem_1")
    selector: Optional[str] = Field(None, description="CSS selector alternative")
    accessible_name: Optional[str] = Field(None, description="Accessible name to match if element moved")
    role: Optional[str] = Field(None, description="Role hint for re-validation")

class BrowserAction(BaseModel):
    action_id: str = Field(..., description="Unique action identifier")
    type: ActionType = Field(..., description="Operation type")
    target: Optional[BrowserActionTarget] = Field(None, description="Target element specification")
    value: Optional[str] = Field(None, description="Value to type/fill/select or URL to navigate to")
    options: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Action options (e.g. scroll delta)")
    reason: str = Field(..., description="Explanation of why this action is being taken")
    requires_approval: bool = Field(False, description="Whether user confirmation is required before execution")
    risk_level: str = Field("LOW", description="Risk category: LOW, MEDIUM, HIGH")

class ActionResult(BaseModel):
    action_id: str = Field(..., description="ID of the executed action")
    success: bool = Field(..., description="Whether the action succeeded")
    error: Optional[str] = Field(None, description="Error message if failed")
    observed_changes: Optional[Dict[str, Any]] = Field(default_factory=dict, description="DOM or URL changes observed")
    current_url: Optional[str] = Field(None, description="URL after action execution")
