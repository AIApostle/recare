from app.agent.tools.page_tools import (
    inspect_current_page,
    find_page_elements,
    set_page_context_store,
    get_page_context_store,
)
from app.agent.tools.browser_tools import (
    execute_browser_action,
    highlight_element,
    get_and_clear_proposed_actions,
)
from app.agent.tools.web_search_tools import search_web_for_information

ALL_TOOLS = [
    inspect_current_page,
    find_page_elements,
    execute_browser_action,
    highlight_element,
    search_web_for_information,
]
