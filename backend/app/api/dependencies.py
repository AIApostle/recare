from app.agent.orchestrator import RecareAgentOrchestrator
from app.services.task_service import orchestrator

def get_orchestrator() -> RecareAgentOrchestrator:
    return orchestrator
