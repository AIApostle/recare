from typing import List, Optional, Dict, Any
from app.schemas.task import TaskState, PlanStep
from app.schemas.actions import ActionType

class TaskPlanner:
    """Creates and manages structured execution plans and state transitions."""

    @staticmethod
    def create_initial_plan(user_request: str, page_context: Optional[Dict[str, Any]] = None) -> List[PlanStep]:
        req_lower = user_request.lower()
        elements = page_context.get("interactive_elements", []) if page_context else []
        
        # Scenario 1: Form filling
        if "fill" in req_lower or "form" in req_lower or "enter" in req_lower:
            input_count = len([e for e in elements if e.get("tag") in ["input", "textarea", "select"]])
            steps = [
                PlanStep(step_number=1, description="Inspect form fields and accessible labels", risk_level="LOW"),
                PlanStep(step_number=2, description="Populate input fields with provided information", action_type="FILL", risk_level="MEDIUM"),
                PlanStep(step_number=3, description="Verify entries and request user confirmation before submission", risk_level="HIGH"),
            ]
            return steps

        # Scenario 2: Invoice / Project / Create
        if "create" in req_lower or "invoice" in req_lower or "project" in req_lower:
            return [
                PlanStep(step_number=1, description="Locate creation button or navigation menu", action_type="HIGHLIGHT", risk_level="LOW"),
                PlanStep(step_number=2, description="Open the creation dialog or form", action_type="CLICK", risk_level="LOW"),
                PlanStep(step_number=3, description="Guide completion of required fields", risk_level="MEDIUM"),
            ]

        # Scenario 3: Download / Bill / Statement
        if "download" in req_lower or "statement" in req_lower or "bill" in req_lower:
            return [
                PlanStep(step_number=1, description="Locate document link or download control", action_type="HIGHLIGHT", risk_level="LOW"),
                PlanStep(step_number=2, description="Trigger authorized download", action_type="CLICK", risk_level="LOW"),
                PlanStep(step_number=3, description="Verify download initiation", risk_level="LOW"),
            ]

        # Scenario 4: Navigate / Search / Find
        if "find" in req_lower or "search" in req_lower or "locate" in req_lower or "where" in req_lower:
            return [
                PlanStep(step_number=1, description="Scan webpage structure and headings for target item", risk_level="LOW"),
                PlanStep(step_number=2, description="Highlight target control or section for user", action_type="HIGHLIGHT", risk_level="LOW"),
                PlanStep(step_number=3, description="Explain purpose and available interactions", risk_level="LOW"),
            ]

        # General default plan
        return [
            PlanStep(step_number=1, description="Understand active page context and user intent", risk_level="LOW"),
            PlanStep(step_number=2, description="Identify relevant interface controls", action_type="HIGHLIGHT", risk_level="LOW"),
            PlanStep(step_number=3, description="Execute requested interaction or guide user", risk_level="MEDIUM"),
        ]

    @staticmethod
    def transition_state(
        current_state: TaskState,
        event: str,
        has_pending_approval: bool = False,
        has_pending_action: bool = False,
    ) -> TaskState:
        """Enforces valid state machine transitions."""
        if event == "CANCEL":
            return TaskState.CANCELLED
        if event == "PAUSE":
            return TaskState.PAUSED
        if event == "FAIL":
            return TaskState.FAILED
        if event == "COMPLETE":
            return TaskState.COMPLETED
            
        if current_state in [TaskState.IDLE, TaskState.UNDERSTANDING]:
            return TaskState.PLANNING
            
        if current_state == TaskState.PLANNING:
            if has_pending_approval:
                return TaskState.WAITING_FOR_USER_APPROVAL
            if has_pending_action:
                return TaskState.WAITING_FOR_ACTION
            return TaskState.COMPLETED

        if current_state == TaskState.WAITING_FOR_ACTION:
            if event == "ACTION_EXECUTING":
                return TaskState.EXECUTING
            if event == "ACTION_RESULT_RECEIVED":
                return TaskState.VERIFYING

        if current_state in [TaskState.EXECUTING, TaskState.VERIFYING]:
            if has_pending_approval:
                return TaskState.WAITING_FOR_USER_APPROVAL
            if has_pending_action:
                return TaskState.WAITING_FOR_ACTION
            return TaskState.COMPLETED

        return current_state
