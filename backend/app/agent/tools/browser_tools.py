import uuid
from typing import Optional, Dict, Any, List
from strands import tool
from app.schemas.actions import ActionType, BrowserAction, BrowserActionTarget
from app.security.policies import PolicyEngine

# Proposed action staging for execution by the extension
_PROPOSED_ACTIONS: List[BrowserAction] = []

def get_and_clear_proposed_actions() -> List[BrowserAction]:
    global _PROPOSED_ACTIONS
    actions = list(_PROPOSED_ACTIONS)
    _PROPOSED_ACTIONS.clear()
    return actions

@tool
def execute_browser_action(
    action_type: str,
    element_id: Optional[str] = None,
    reason: str = "Perform step",
    value: Optional[str] = None,
    selector: Optional[str] = None,
) -> str:
    """Request a browser action (CLICK, TYPE, FILL, SELECT, SCROLL, NAVIGATE, PRESS_KEY).
    
    The action will be evaluated by safety policy and sent to the extension for controlled execution.
    """
    try:
        act_enum = ActionType(action_type.upper())
    except ValueError:
        return f"Invalid action_type: {action_type}. Supported: {[a.value for a in ActionType]}"

    action = BrowserAction(
        action_id=f"act_{uuid.uuid4().hex[:8]}",
        type=act_enum,
        target=BrowserActionTarget(element_id=element_id, selector=selector) if (element_id or selector) else None,
        value=value,
        reason=reason,
    )
    
    # Run through trusted safety policy engine
    action = PolicyEngine.evaluate(action)
    _PROPOSED_ACTIONS.append(action)
    
    return (
        f"Proposed browser action {action.action_id}: {action.type} "
        f"(Risk: {action.risk_level}, Requires Approval: {action.requires_approval}). Reason: {reason}"
    )

@tool
def highlight_element(element_id: str, label: str = "Relevant Control") -> str:
    """Request visual highlighting of a webpage element to visually guide the user."""
    action = BrowserAction(
        action_id=f"act_hl_{uuid.uuid4().hex[:8]}",
        type=ActionType.HIGHLIGHT,
        target=BrowserActionTarget(element_id=element_id),
        reason=f"Highlight for user: {label}",
        risk_level="LOW",
        requires_approval=False,
    )
    _PROPOSED_ACTIONS.append(action)
    return f"Highlighted element {element_id} for user with label '{label}'."

@tool
def scroll_webpage(direction: str = "down", amount: int = 550) -> str:
    """Scroll the active webpage or browser window up or down to reveal more content.
    Args:
        direction: 'down', 'up', 'top', or 'bottom'.
        amount: Number of pixels to scroll (defaults to 550).
    """
    d_lower = direction.lower().strip()
    if d_lower == "bottom":
        delta = 99999
    elif d_lower == "top":
        delta = -99999
    elif d_lower == "up":
        delta = -abs(amount)
    else:
        delta = abs(amount)

    action = BrowserAction(
        action_id=f"act_sc_{uuid.uuid4().hex[:8]}",
        type=ActionType.SCROLL,
        options={"deltaY": delta, "delta_y": delta},
        reason=f"Scrolling {direction} the page",
        risk_level="LOW",
        requires_approval=False,
    )
    _PROPOSED_ACTIONS.append(action)
    return f"Requested browser scroll {direction} by {abs(delta)}px."

@tool
def search_the_web_in_browser(query: str) -> str:
    """Search the web directly in the user's browser by navigating to Google search.
    Args:
        query: The search terms or question to look up.
    """
    import urllib.parse
    clean_q = urllib.parse.quote(query.strip())
    action = BrowserAction(
        action_id=f"act_sr_{uuid.uuid4().hex[:8]}",
        type=ActionType.NAVIGATE,
        value=f"https://www.google.com/search?q={clean_q}",
        reason=f"Searching for '{query}' on Google",
        risk_level="LOW",
        requires_approval=False,
    )
    _PROPOSED_ACTIONS.append(action)
    return f"Navigating browser to Google Search for '{query}'."
