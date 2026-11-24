import re
from typing import Tuple, Optional
from app.schemas.actions import BrowserAction, ActionType
from app.schemas.safety import RiskLevel

# Keywords indicating consequential, high-risk actions
CONSEQUENTIAL_KEYWORDS = [
    r"\bsubmit\b",
    r"\bpay\b",
    r"\bpayment\b",
    r"\bpurchase\b",
    r"\bbuy\b",
    r"\bcheckout\b",
    r"\bdelete\b",
    r"\bremove\b",
    r"\bdestroy\b",
    r"\bsend\b",
    r"\bpublish\b",
    r"\btransfer\b",
    r"\bconfirm order\b",
    r"\bplace order\b",
    r"\bterminate\b",
    r"\bdeactivate\b",
    r"\breset password\b",
    r"\bauthori[sz]e\b",
    r"\bsign\b",
]

CONSEQUENTIAL_PATTERN = re.compile("|".join(CONSEQUENTIAL_KEYWORDS), re.IGNORECASE)

class PolicyEngine:
    """Trusted security engine that classifies proposed browser actions and enforces approval gates."""

    @staticmethod
    def classify_action(action: BrowserAction, target_text: Optional[str] = None) -> Tuple[RiskLevel, bool, str]:
        """Classify action risk level and determine whether user approval is required.
        
        Returns:
            Tuple of (RiskLevel, requires_approval: bool, reason: str)
        """
        # Low risk by nature
        if action.type in [
            ActionType.SCROLL,
            ActionType.READ,
            ActionType.HIGHLIGHT,
            ActionType.WAIT,
        ]:
            return RiskLevel.LOW, False, "Read-only or visual assistance operation"

        if action.type == ActionType.NAVIGATE:
            return RiskLevel.LOW, False, "Page navigation"

        # Check for target text and attributes
        check_text = " ".join([
            action.reason or "",
            action.target.accessible_name if action.target and action.target.accessible_name else "",
            target_text or "",
            action.value or "",
        ])

        # Consequential check
        if CONSEQUENTIAL_PATTERN.search(check_text):
            return (
                RiskLevel.HIGH,
                True,
                "This action involves a consequential operation (such as payment, submission, deletion, or messaging) that requires explicit confirmation."
            )

        # File upload check
        if action.type == ActionType.REQUEST_FILE_UPLOAD:
            return RiskLevel.HIGH, True, "File uploads must always be explicitly authorized and selected by the user."

        # Moderate risk actions: typing/filling without submit keywords
        if action.type in [ActionType.TYPE, ActionType.FILL, ActionType.SELECT]:
            return RiskLevel.MEDIUM, False, "Data entry into input field (reversible before form submission)"

        if action.type == ActionType.CLICK:
            # Normal buttons, links, tabs, accordions are LOW risk if no dangerous keywords
            return RiskLevel.LOW, False, "Interaction with standard interface element"

        return RiskLevel.MEDIUM, False, "General interface operation"

    @classmethod
    def evaluate(cls, action: BrowserAction, target_text: Optional[str] = None) -> BrowserAction:
        """Evaluate and attach risk level and approval requirement to action."""
        risk_level, requires_approval, reason = cls.classify_action(action, target_text)
        action.risk_level = risk_level.value
        action.requires_approval = requires_approval
        return action
