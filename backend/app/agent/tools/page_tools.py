from typing import Optional, List, Dict, Any
from strands import tool

# Context storage passed into tools during task execution
_CURRENT_PAGE_CONTEXT: Dict[str, Any] = {}

def set_page_context_store(context: Dict[str, Any]) -> None:
    global _CURRENT_PAGE_CONTEXT
    _CURRENT_PAGE_CONTEXT = context

def get_page_context_store() -> Dict[str, Any]:
    return _CURRENT_PAGE_CONTEXT

@tool
def inspect_current_page() -> str:
    """Inspect the current active webpage, returning its title, domain, URL, and summary of interactive elements."""
    ctx = _CURRENT_PAGE_CONTEXT
    if not ctx:
        return "No active webpage context available."
    
    title = ctx.get("title", "Untitled")
    domain = ctx.get("domain", "")
    url = ctx.get("url", "")
    elements = ctx.get("interactive_elements", [])
    headings = ctx.get("headings", [])
    
    element_summaries = []
    for el in elements[:20]:
        name = el.get("accessible_name") or el.get("text") or el.get("placeholder") or "unnamed"
        tag = el.get("tag", "element")
        role = el.get("role") or tag
        eid = el.get("element_id")
        element_summaries.append(f"[{eid}] {role}: '{name}' (tag: {tag})")
        
    heading_str = ", ".join([f"H{h.get('level')}: {h.get('text')}" for h in headings[:5]])
    
    return (
        f"Webpage: '{title}' ({domain})\n"
        f"URL: {url}\n"
        f"Headings: {heading_str or 'None'}\n"
        f"Found {len(elements)} interactive controls. Key elements:\n" +
        "\n".join(element_summaries)
    )

@tool
def find_page_elements(query: str, role: Optional[str] = None) -> str:
    """Search for interface elements by keyword, accessible name, label, or role."""
    elements = _CURRENT_PAGE_CONTEXT.get("interactive_elements", [])
    query_lower = query.lower()
    matches = []
    
    for el in elements:
        name = (el.get("accessible_name") or "").lower()
        text = (el.get("text") or "").lower()
        placeholder = (el.get("placeholder") or "").lower()
        el_role = (el.get("role") or el.get("tag") or "").lower()
        
        role_matches = (role is None) or (role.lower() in el_role)
        text_matches = query_lower in name or query_lower in text or query_lower in placeholder or query_lower in el_role
        
        if role_matches and text_matches:
            matches.append(
                f"ID: {el.get('element_id')} | Role: {el.get('role', el.get('tag'))} | "
                f"Accessible Name: '{el.get('accessible_name') or el.get('text')}' | Tag: <{el.get('tag')}>"
            )
            
    if not matches:
        return f"No elements found matching query: '{query}'" + (f" with role '{role}'" if role else "")
        
    return f"Found {len(matches)} matching element(s):\n" + "\n".join(matches[:10])
