from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

class ElementMetadata(BaseModel):
    element_id: str = Field(..., description="Stable page-scoped element identifier (e.g. elem_1)")
    role: Optional[str] = Field(None, description="ARIA or semantic role, e.g. button, link, textbox")
    tag: str = Field(..., description="HTML tag, e.g. button, input, a")
    accessible_name: Optional[str] = Field(None, description="Computed accessible name / label / aria-label")
    text: Optional[str] = Field(None, description="Visible inner text content (truncated)")
    selector: Optional[str] = Field(None, description="CSS selector for the element")
    is_visible: bool = Field(True, description="Whether the element is visible in the viewport or page")
    is_enabled: bool = Field(True, description="Whether the control is enabled and interactive")
    input_type: Optional[str] = Field(None, description="For inputs: text, email, number, checkbox, etc.")
    current_value: Optional[str] = Field(None, description="Current field value (passwords sanitized)")
    placeholder: Optional[str] = Field(None, description="Input placeholder text")
    href: Optional[str] = Field(None, description="Link target href if applicable")
    bounds: Optional[Dict[str, float]] = Field(None, description="Bounding client rect (x, y, width, height)")

class HeadingItem(BaseModel):
    level: int = Field(..., description="Heading level 1-6")
    text: str = Field(..., description="Heading text content")

class PageContext(BaseModel):
    url: str = Field(..., description="Full current URL of the active tab")
    domain: str = Field(..., description="Current domain hostname")
    title: str = Field(..., description="Title of the active webpage")
    headings: List[HeadingItem] = Field(default_factory=list, description="Extracted headings in order")
    interactive_elements: List[ElementMetadata] = Field(
        default_factory=list, description="Discovered interactive controls"
    )
    main_content_summary: Optional[str] = Field(
        None, description="Summarized visible body text (scripts/styles stripped)"
    )
    notifications: List[str] = Field(
        default_factory=list, description="Active status alerts, notices, or toast popups on the page"
    )
    screenshot_base64: Optional[str] = Field(
        None, description="Base64 encoded JPEG screenshot of the visible tab for visual understanding"
    )
    timestamp: Optional[str] = Field(None, description="ISO timestamp of context capture")
