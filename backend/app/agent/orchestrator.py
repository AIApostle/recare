import uuid
from typing import Optional, Dict, Any, List
from strands import Agent
from app.core.config import settings
from app.core.logging import logger
from app.agent.prompts import RECARE_SYSTEM_PROMPT, GUIDE_MODE_PROMPT, ASSIST_MODE_PROMPT, AUTONOMOUS_MODE_PROMPT
from app.agent.tools.page_tools import set_page_context_store
from app.agent.tools import ALL_TOOLS
from app.agent.tools.browser_tools import get_and_clear_proposed_actions
from app.agent.planning import TaskPlanner
from app.schemas.task import TaskState, TaskResponse, PlanStep
from app.schemas.actions import BrowserAction, ActionResult, ActionType, BrowserActionTarget
from app.schemas.safety import ApprovalRequest, RiskLevel
from app.schemas.chat import ChatResponse, HighlightTarget
from app.security.policies import PolicyEngine
from app.security.injection_defense import PromptInjectionDefense

class RecareAgentOrchestrator:
    """Coordinates Strands Agent reasoning, task planning, and browser action generation."""

    def __init__(self):
        self.system_prompt = RECARE_SYSTEM_PROMPT
        logger.info(f"Initialized RecareAgentOrchestrator (Provider: {settings.MODEL_PROVIDER})")

    def _get_mode_prompt(self, mode: str) -> str:
        if mode == "guide":
            return GUIDE_MODE_PROMPT
        if mode == "autonomous":
            return AUTONOMOUS_MODE_PROMPT
        return ASSIST_MODE_PROMPT

    def _build_agent(self, mode: str) -> Agent:
        """Instantiate a Strands Agent with configured tools and system prompt."""
        mode_instruction = self._get_mode_prompt(mode)
        full_prompt = f"{self.system_prompt}\n\n{mode_instruction}"
        
        # Build Strands Agent with our toolsuite
        return Agent(
            tools=ALL_TOOLS,
            system_prompt=full_prompt,
        )

    async def handle_chat(
        self,
        message: str,
        page_context: Optional[Dict[str, Any]] = None,
        mode: str = "guide",
        simplified: bool = False,
    ) -> ChatResponse:
        """Process an interactive chat or page question."""
        ctx = page_context or {}
        set_page_context_store(ctx)
        
        title = ctx.get("title", "Current Page")
        domain = ctx.get("domain", "current site")
        headings = ctx.get("headings", [])
        elements = ctx.get("interactive_elements", [])
        
        # Check for prompt injection in page context
        clean_summary = PromptInjectionDefense.sanitize_webpage_content(
            ctx.get("main_content_summary", "")
        )

        msg_lower = message.lower()
        highlight_targets: List[HighlightTarget] = []
        suggested_actions: List[str] = []
        suggested_task: Optional[str] = None
        
        # Match elements for visual assistance / questions
        if "what am i looking at" in msg_lower or "explain" in msg_lower or "what is this" in msg_lower:
            h_text = ", ".join([h.get("text") for h in headings[:3]]) if headings else "main content"
            elem_types = list(set([e.get("tag") for e in elements[:10]]))
            
            if simplified:
                reply = (
                    f"You are looking at '{title}' on {domain}. "
                    f"It has sections about {h_text}. "
                    f"There are buttons and options you can use."
                )
                spoken = f"You are on {title}. Tell me if you want me to read or click anything."
            else:
                reply = (
                    f"You are on **{title}** ({domain}).\n\n"
                    f"**Structure**: Main headings include: {h_text}.\n"
                    f"**Interactive controls**: Discovered {len(elements)} interactive elements "
                    f"including {', '.join(elem_types) if elem_types else 'buttons and links'}.\n\n"
                    f"Let me know what you'd like to do, or ask me to highlight any specific control."
                )
                spoken = f"You are on {title}. Found {len(elements)} controls. How can I help?"
                
            suggested_actions = ["Highlight key buttons", "Help me fill this form", "Explain the steps"]
            
        elif "highlight" in msg_lower or "where is" in msg_lower or "find" in msg_lower or "button" in msg_lower:
            # Find candidate elements
            matching_elems = [
                e for e in elements 
                if any(k in (e.get("accessible_name") or e.get("text") or "").lower() for k in msg_lower.split())
            ]
            target = matching_elems[0] if matching_elems else (elements[0] if elements else None)
            
            if target:
                name = target.get("accessible_name") or target.get("text") or "Control"
                highlight_targets.append(HighlightTarget(
                    element_id=target.get("element_id"),
                    selector=target.get("selector"),
                    accessible_name=name,
                    label=name,
                ))
                reply = f"I've highlighted the **{name}** ({target.get('role', target.get('tag'))}) on the page for you."
                spoken = f"Highlighted {name}."
            else:
                reply = f"I could not locate an element matching your request on this page."
                spoken = "I could not locate that element."
                
            suggested_actions = ["Click it for me", "Explain what it does", "Show other controls"]
            
        else:
            # General assistance
            reply = (
                f"I'm here to help you with **{title}**. "
                f"You can ask me to explain any control, highlight buttons, or carry out a task like filling forms or downloading files."
            )
            spoken = f"Ready to help on {title}."
            suggested_task = message if len(message.split()) > 2 else None
            suggested_actions = ["What am I looking at?", "Guide me through this page", "Help me with a task"]

        return ChatResponse(
            reply=reply,
            spoken_summary=spoken,
            highlight_targets=highlight_targets,
            suggested_actions=suggested_actions,
            suggested_task=suggested_task,
        )

    async def step_task(
        self,
        task_id: str,
        user_request: str,
        mode: str,
        page_context: Optional[Dict[str, Any]] = None,
        last_action_result: Optional[ActionResult] = None,
        approved: Optional[bool] = None,
    ) -> TaskResponse:
        """Execute one reasoning/execution step of a task."""
        ctx = page_context or {}
        set_page_context_store(ctx)
        elements = ctx.get("interactive_elements", [])
        
        # Build plan
        plan = TaskPlanner.create_initial_plan(user_request, ctx)
        
        # If user explicitly approved or rejected
        if approved is False:
            return TaskResponse(
                task_id=task_id,
                state=TaskState.CANCELLED,
                mode=mode,
                user_request=user_request,
                plan=plan,
                message="Task was stopped because the action approval was declined.",
            )

        # In GUIDE mode: do not execute actions, only highlight and explain
        if mode == "guide":
            target_el = elements[0] if elements else None
            action = None
            if target_el:
                action = BrowserAction(
                    action_id=f"act_hl_{uuid.uuid4().hex[:8]}",
                    type=ActionType.HIGHLIGHT,
                    target=BrowserActionTarget(element_id=target_el.get("element_id")),
                    reason=f"Highlight relevant control for guide mode: {target_el.get('accessible_name') or 'control'}",
                    risk_level="LOW",
                    requires_approval=False,
                )
            return TaskResponse(
                task_id=task_id,
                state=TaskState.COMPLETED,
                mode=mode,
                user_request=user_request,
                plan=plan,
                current_action=action,
                message="Guide mode active: Explained workflow and highlighted relevant controls.",
                completion_summary="Guided step provided without executing browser actions.",
            )

        # ASSIST / AUTONOMOUS mode execution logic:
        # Check if an action was already executed in previous step
        if last_action_result:
            if not last_action_result.success:
                err_msg = last_action_result.error or "Target element was obscured or unresponsive."
                logger.warning(f"[Recare Tool Feedback] Action {last_action_result.action_id} failed: {err_msg}")
                return TaskResponse(
                    task_id=task_id,
                    state=TaskState.FAILED,
                    mode=mode,
                    user_request=user_request,
                    plan=plan,
                    error=f"Browser action failed: {err_msg}",
                )

            # Action succeeded! Inspect observed DOM changes & feedback
            changes = last_action_result.observed_changes or {}
            url_changed = changes.get("url_changed", False)
            if url_changed and last_action_result.current_url:
                feedback_msg = f"Verified action: Page navigated to {last_action_result.current_url}."
            else:
                feedback_msg = f"Verified action: Executed successfully on '{ctx.get('title', 'active page')}'."

            logger.info(f"[Recare Tool Feedback] {feedback_msg}")

            # Transition plan steps
            for p in plan:
                p.status = "COMPLETED"

            return TaskResponse(
                task_id=task_id,
                state=TaskState.COMPLETED,
                mode=mode,
                user_request=user_request,
                plan=plan,
                message=feedback_msg,
                completion_summary=f"Task '{user_request}' completed with verified DOM feedback.",
            )

        # Propose the next browser action based on user request and elements
        req_lower = user_request.lower()
        candidate_el = None
        action_type = ActionType.CLICK
        val = None

        if "fill" in req_lower or "enter" in req_lower or "type" in req_lower:
            inputs = [e for e in elements if e.get("tag") in ["input", "textarea"] and e.get("input_type") != "password"]
            if inputs:
                candidate_el = inputs[0]
                action_type = ActionType.FILL
                val = "Sample Value"
        else:
            # Look for button or link matching intent
            for el in elements:
                name = (el.get("accessible_name") or el.get("text") or "").lower()
                if any(w in name for w in req_lower.split() if len(w) > 3):
                    candidate_el = el
                    break
            if not candidate_el and elements:
                candidate_el = elements[0]

        if not candidate_el:
            return TaskResponse(
                task_id=task_id,
                state=TaskState.COMPLETED,
                mode=mode,
                user_request=user_request,
                plan=plan,
                message="Understood webpage, but no further interactive controls required for this goal.",
                completion_summary="Analysis completed.",
            )

        # Create proposed browser action
        action_id = f"act_{uuid.uuid4().hex[:8]}"
        action = BrowserAction(
            action_id=action_id,
            type=action_type,
            target=BrowserActionTarget(
                element_id=candidate_el.get("element_id"),
                selector=candidate_el.get("selector"),
                accessible_name=candidate_el.get("accessible_name") or candidate_el.get("text"),
                role=candidate_el.get("role") or candidate_el.get("tag"),
            ),
            value=val,
            reason=f"Execute step: {candidate_el.get('accessible_name') or 'control'} for '{user_request}'",
        )

        # Evaluate through policy engine
        action = PolicyEngine.evaluate(action, target_text=candidate_el.get("accessible_name") or candidate_el.get("text"))

        # Check if approval is required
        if action.requires_approval and not approved:
            approval_req = ApprovalRequest(
                approval_id=f"appr_{uuid.uuid4().hex[:8]}",
                task_id=task_id,
                action_id=action.action_id,
                action_type=action.type.value,
                risk_level=RiskLevel(action.risk_level),
                target_description=f"Action '{action.type.value}' on '{candidate_el.get('accessible_name') or candidate_el.get('element_id')}'",
                reason=action.reason,
                affected_domain=ctx.get("domain"),
                data_payload=action.value,
            )
            return TaskResponse(
                task_id=task_id,
                state=TaskState.WAITING_FOR_USER_APPROVAL,
                mode=mode,
                user_request=user_request,
                plan=plan,
                current_action=action,
                pending_approval=approval_req,
                message="This action involves a consequential step. Please review and approve before proceeding.",
            )

        return TaskResponse(
            task_id=task_id,
            state=TaskState.WAITING_FOR_ACTION,
            mode=mode,
            user_request=user_request,
            plan=plan,
            current_action=action,
            message=f"Executing {action.type.value} on {candidate_el.get('accessible_name') or 'target control'}.",
        )
