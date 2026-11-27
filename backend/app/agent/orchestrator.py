import json
import re
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
        self._task_state: Dict[str, Dict[str, Any]] = {}
        logger.info(f"Initialized RecareAgentOrchestrator (Provider: {settings.MODEL_PROVIDER})")

    @staticmethod
    def _extract_search_query(user_request: str) -> str:
        """Extract clean search terms from conversational requests like 'can you search for The Social Network for me'."""
        text = user_request.strip()

        # 1. Handle "maybe <term>" or "like <term>" (e.g. "search for something on the search bar maybe social network or")
        maybe_m = re.search(
            r"\b(?:maybe|like)\s+[\"']?([a-zA-Z0-9\s]{2,40}?)[\"']?(?:\s+(?:or|and|please|can you).*)?$",
            text,
            re.IGNORECASE,
        )
        if maybe_m:
            candidate = maybe_m.group(1).strip()
            if candidate and candidate.lower() not in {"something", "it", "this", "that", "anything"}:
                return candidate

        patterns = [
            r"(?:search\s+for|look\s+up|find\s+me|search|find)\s+[\"']?(.+?)[\"']?(?:\s+(?:can you|please|for me|on this|in the search|on the search).*)?$",
        ]
        for pat in patterns:
            m = re.search(pat, text, re.IGNORECASE)
            if m:
                cleaned = re.sub(
                    r"\s*(?:can you\s+search.*|please|for me|on this site|on this page|in the search bar|on the search bar).*$",
                    "",
                    m.group(1),
                    flags=re.IGNORECASE,
                ).strip(" .?!\"'")
                if cleaned and cleaned.lower() not in {"it", "that", "something", "this", "anything"}:
                    return cleaned
        return text

    @staticmethod
    def _parse_json_plan(llm_text: str) -> Optional[Dict[str, Any]]:
        """Parse JSON planning block emitted by the LLM."""
        raw = llm_text.strip()
        fence = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", raw, re.DOTALL)
        if fence:
            raw = fence.group(1)
        elif "{" in raw and "}" in raw:
            start = raw.find("{")
            end = raw.rfind("}") + 1
            raw = raw[start:end]
        try:
            data = json.loads(raw)
            return data if isinstance(data, dict) else None
        except Exception:
            return None

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

    @staticmethod
    def _extract_stream_text(ev: Any) -> str:
        """Extract delta text from either dict or Strands stream event objects."""
        if isinstance(ev, dict):
            delta = ev.get("delta")
            if isinstance(delta, dict):
                return str(delta.get("text", ""))
            if isinstance(delta, str):
                return delta
            return ""
        if hasattr(ev, "delta"):
            delta = getattr(ev, "delta")
            if hasattr(delta, "text"):
                return str(delta.text)
            if isinstance(delta, str):
                return delta
        return ""

    async def handle_chat(
        self,
        message: str,
        page_context: Optional[Dict[str, Any]] = None,
        mode: str = "guide",
        simplified: bool = False,
        conversation_history: Optional[List[Dict[str, Any]]] = None,
        image_base64: Optional[str] = None,
    ) -> ChatResponse:
        """Process an interactive chat or page question with live AI inference."""
        ctx = page_context or {}
        set_page_context_store(ctx)
        
        title = ctx.get("title", "Current Page")
        domain = ctx.get("domain", "current site")
        headings = ctx.get("headings", [])
        elements = ctx.get("interactive_elements", [])
        
        from app.agent.models import get_model
        model = get_model(settings.MODEL_PROVIDER, settings.MODEL_NAME)
        reply = None

        h_str = ", ".join([h.get("text", "") for h in headings[:5]]) if headings else "General page content"
        el_str = ", ".join(
            [e.get("accessible_name") or e.get("text") or "" for e in elements[:12] if (e.get("accessible_name") or e.get("text"))]
        )

        # Dynamic online background research if user asks about the website or an entity/topic
        msg_lower = message.lower()
        research_context = ""
        is_research_query = any(k in msg_lower for k in [
            "what is this website", "what is this site", "tell me about this site",
            "what is this company", "who is", "what is", "research", "search for", "about this page"
        ])

        # Check if user is asking for research, doc generation, or file preparation
        is_doc_or_file_request = (
            any(k in msg_lower for k in ["research", "investigate", "study", "analysis", "deep dive"])
            and any(k in msg_lower for k in ["doc", "document", "file", "download", "report", "paper", "notes", "write"])
        ) or any(k in msg_lower for k in [
            "send me the doc", "send me a doc", "send me the file", "send the file to me",
            "download it", "generate a doc", "prepare a doc", "create a doc", "create a report"
        ])

        if is_doc_or_file_request:
            from app.agent.tools.web_search_tools import search_web_for_information
            from app.schemas.chat import GeneratedDocument
            topic = re.sub(
                r"\b(can you|please|i want to|could you|do a|do|research|about|on|and|send me the doc|send me a doc|send the file to me|send me the file|download it|generate|prepare|create|file|doc|document|notes|report)\b",
                " ",
                msg_lower,
                flags=re.IGNORECASE
            ).strip()
            if not topic:
                topic = title or domain or "Web Topic"

            web_info = ""
            try:
                web_info = search_web_for_information(topic)
            except Exception:
                pass

            doc_prompt = (
                f"You are Recare, an autonomous AI research agent.\n"
                f"Task: Generate a comprehensive, professional, well-structured research document on: '{topic}'.\n"
                f"Online search findings:\n{web_info or 'Provide exhaustive, accurate knowledge.'}\n\n"
                f"Structure the document in clean Markdown with:\n"
                f"# Research Report: {topic.title()}\n"
                f"## 1. Executive Summary\n"
                f"## 2. Key Highlights & Findings\n"
                f"## 3. In-Depth Analysis\n"
                f"## 4. Key Takeaways & Recommendations\n"
                f"## 5. Sources & References\n\n"
                f"Make it high quality, detailed, and directly downloadable."
            )
            try:
                from strands.types.content import Message
                events = model.stream(messages=[Message(role="user", content=doc_prompt)])
                chunks = [self._extract_stream_text(ev) async for ev in events]
                doc_content = "".join(chunks).strip()
                if doc_content:
                    clean_slug = re.sub(r"[^a-zA-Z0-9_]+", "_", topic.lower()).strip("_")[:30] or "research"
                    generated_doc = GeneratedDocument(
                        title=f"Research Report: {topic.title()}",
                        filename=f"recare_research_{clean_slug}.md",
                        content=doc_content,
                        mime_type="text/markdown",
                    )
                    doc_reply = (
                        f"I have conducted research on **{topic.title()}** and compiled a complete research report for you.\n\n"
                        f"You can review the key findings and click **Download Document** below to save the file directly to your device."
                    )
                    return ChatResponse(
                        reply=doc_reply,
                        spoken_summary=doc_reply,
                        highlight_targets=[],
                        suggested_actions=["Explain this page", "Help me fill this form"],
                        generated_document=generated_doc,
                    )
            except Exception as e:
                logger.warning(f"Error generating research doc: {e}")

        if is_research_query:
            from app.agent.tools.web_search_tools import search_web_for_information
            search_target = domain.replace("www.", "").split(".")[0] if ("website" in msg_lower or "site" in msg_lower or "company" in msg_lower) else message
            try:
                web_info = search_web_for_information(search_target)
                if web_info and not web_info.startswith("Web search results for"):
                    research_context = f"\nOnline Research & Background Data:\n{web_info}\n"
            except Exception:
                pass

        system_instruction = (
            f"You are Recare, an accessibility AI browser assistant with full browser navigation, search, and research capabilities. "
            f"The user is currently viewing the page '{title}' on domain '{domain}'. "
            f"URL: {ctx.get('url', '')}. "
            f"Headings: {h_str}. "
            f"Visible controls: {el_str}. "
            f"{research_context}"
            f"Answer the user's question directly in clear, natural, everyday language. "
            f"If the user asks what page they are on, what site this is, or where they are, warmly and directly tell them the current page title ('{title}') and website ('{domain}'), and summarize what it is. "
            f"If the user asks if you can search, browse, or why you can't search: warmly confirm that you CAN search the web and navigate the browser. Explain that you can search on the current webpage's search bar, navigate to Google directly, or conduct online background research. "
            f"When explaining what a website is about, explain its purpose, key features, and what the user can do there. "
            f"NEVER mention internal IDs like [elem_1] or elem_4, and NEVER refer to the browser extension itself as the webpage."
            + (" Use very simple, plain language." if simplified else "")
        )

        screenshot_b64 = image_base64 or ctx.get("screenshot_base64")
        try:
            from strands.types.content import Message
            stream_messages: List[Any] = []
            for h in (conversation_history or [])[-10:]:
                role = "assistant" if h.get("role") == "assistant" else "user"
                content = str(h.get("content", "")).strip()
                if content:
                    stream_messages.append(Message(role=role, content=content))
            stream_messages.append(Message(role="user", content=message))

            events = model.stream(
                messages=stream_messages,
                system_prompt=system_instruction,
                image_base64=screenshot_b64,
            )
            chunks = [self._extract_stream_text(ev) async for ev in events]
            text = "".join(chunks).strip()
            if text:
                reply = re.sub(r"\[?elem_\d+\]?\s*", "", text).strip()
        except Exception as e:
            logger.warning(f"Error querying model for chat: {e}")

        if not reply:
            reply = "AI model is currently not available."

        return ChatResponse(
            reply=reply,
            spoken_summary=reply,
            highlight_targets=[],
            suggested_actions=["Explain this page", "Help me fill this form", "Where is the submit button?"],
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
        title = ctx.get("title") or ctx.get("domain") or "this page"
        domain = ctx.get("domain", "")
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
            label = "relevant control"
            if target_el:
                label = target_el.get("accessible_name") or target_el.get("text") or target_el.get("tag") or "control"
                action = BrowserAction(
                    action_id=f"act_hl_{uuid.uuid4().hex[:8]}",
                    type=ActionType.HIGHLIGHT,
                    target=BrowserActionTarget(
                        element_id=target_el.get("element_id"),
                        accessible_name=label,
                        role=target_el.get("role") or target_el.get("tag"),
                    ),
                    reason=f"Highlighting {label}",
                    risk_level="LOW",
                    requires_approval=False,
                )
            guide_reply = f"I've highlighted '{label}' for you on this page." if target_el else f"You are viewing '{title}'. What would you like guidance on?"
            return TaskResponse(
                task_id=task_id,
                state=TaskState.COMPLETED,
                mode=mode,
                user_request=user_request,
                plan=plan,
                current_action=action,
                message=guide_reply,
                completion_summary=f"Highlighted {label}." if target_el else "Guided context provided.",
            )

        # ASSIST / AUTONOMOUS mode execution logic:
        # Check if an action was already executed in previous step -> Observe, Verify, and Continue Loop if needed!
        MAX_AGENT_STEPS = 6
        if last_action_result:
            meta = self._task_state.get(task_id, {})
            step_count = int(meta.get("step_count", 1))
            action_history: List[Dict[str, Any]] = list(meta.get("history", []))

            if not last_action_result.success:
                self._task_state.pop(task_id, None)
                err_msg = last_action_result.error or "Target element was obscured or unresponsive."
                logger.warning(f"[Recare Tool Feedback] Action {last_action_result.action_id} failed: {err_msg}")
                return TaskResponse(
                    task_id=task_id,
                    state=TaskState.FAILED,
                    mode=mode,
                    user_request=user_request,
                    plan=plan,
                    error=f"I tried to complete that, but ran into an issue: {err_msg}",
                )

            # Record latest action into trajectory
            action_history.append({
                "step": step_count,
                "action": meta.get("last_action_type", "ACTION"),
                "target": meta.get("last_target_label", ""),
                "value": meta.get("last_value", ""),
                "url_after": last_action_result.current_url or ctx.get("url", ""),
                "observed_changes": last_action_result.observed_changes or {},
            })

            # Deterministic multi-step chaining: e.g. Step 1 clicked Search toggle, Step 2 fills & submits query
            follow_up_query = meta.pop("follow_up_search_query", None)
            if follow_up_query and step_count < MAX_AGENT_STEPS:
                search_inputs = [
                    e for e in elements
                    if e.get("tag") in ["input", "textarea"]
                    and e.get("input_type") not in ["password", "hidden", "checkbox", "radio", "submit"]
                ]
                search_inputs.sort(
                    key=lambda e: 0
                    if (
                        e.get("input_type") == "search"
                        or "search" in f"{e.get('accessible_name', '')} {e.get('placeholder', '')}".lower()
                    )
                    else 1
                )
                if search_inputs:
                    target_input = search_inputs[0]
                    next_action = BrowserAction(
                        action_id=f"act_{uuid.uuid4().hex[:8]}",
                        type=ActionType.FILL,
                        target=BrowserActionTarget(
                            element_id=target_input.get("element_id"),
                            selector=target_input.get("selector"),
                            accessible_name=target_input.get("accessible_name") or target_input.get("placeholder") or "Search",
                            role=target_input.get("role") or target_input.get("tag"),
                        ),
                        value=follow_up_query,
                        options={"submit": True, "submit_search": True},
                        reason=f"Searching for '{follow_up_query}'",
                    )
                    next_action = PolicyEngine.evaluate(
                        next_action,
                        target_text=target_input.get("accessible_name") or target_input.get("placeholder"),
                    )
                    self._task_state[task_id] = {
                        "step_count": step_count + 1,
                        "history": action_history,
                        "last_action_type": "FILL",
                        "last_target_label": target_input.get("accessible_name") or target_input.get("placeholder") or "Search",
                        "last_value": follow_up_query,
                        "completion_reply": f"Done — I searched for '{follow_up_query}' and loaded the results for you.",
                    }
                    return TaskResponse(
                        task_id=task_id,
                        state=TaskState.WAITING_FOR_ACTION,
                        mode=mode,
                        user_request=user_request,
                        plan=plan,
                        current_action=next_action,
                        message="",
                    )

            # Verification & Autonomous Multi-Step Continuation via LLM on fresh DOM + Screenshot
            should_verify_with_llm = (
                settings.MODEL_PROVIDER == "gemini"
                and step_count < MAX_AGENT_STEPS
                and len(elements) > 0
                and meta.get("last_action_type") not in ["SCROLL"]
            )

            verified_completion_reply: Optional[str] = meta.get("completion_reply")

            if should_verify_with_llm:
                try:
                    from app.agent.models import get_model
                    from strands.types.content import Message

                    model = get_model(settings.MODEL_PROVIDER, settings.MODEL_NAME)
                    elements_summary = "\n".join([
                        f"[{e.get('element_id')}] <{e.get('tag')} type='{e.get('input_type', '')}'> text='{e.get('accessible_name') or e.get('text') or ''}' placeholder='{e.get('placeholder', '')}' href='{e.get('href', '')}'"
                        for e in elements[:35]
                    ])
                    history_str = json.dumps(action_history)
                    page_summary = str(ctx.get("main_content_summary", ""))[:1000]

                    verify_prompt = (
                        f"You are Recare, an autonomous browser agent verifying execution.\n"
                        f"User Goal: \"{user_request}\"\n"
                        f"Steps Executed So Far: {history_str}\n"
                        f"Current Page After Last Step:\n"
                        f"  Title: {ctx.get('title', '')}\n"
                        f"  URL: {last_action_result.current_url or ctx.get('url', '')}\n"
                        f"  Content Snippet: {page_summary}\n"
                        f"  Visible Controls:\n{elements_summary}\n\n"
                        f"Decide carefully:\n"
                        f"1. Has the user's goal ACTUALLY succeeded on this webpage (for example, search results loaded, page navigated back, or requested link opened)?\n"
                        f"2. Or did the last step only open a menu/search box/overlay, meaning another action is STILL needed to finish '{user_request}'?\n"
                        f"Rules:\n"
                        f"- Never repeat the exact same click/action on the same untouched page.\n"
                        f"- If goal is achieved, set \"goal_achieved\": true and write a clear, warm 1-sentence past-tense 'completion_reply' (no element IDs or technical jargon).\n"
                        f"- If another step is needed, set \"goal_achieved\": false and specify the next action.\n"
                        f"Return strict JSON only:\n"
                        f'{{"goal_achieved":true,"action":"CLICK|FILL|NAVIGATE|SCROLL","element_id":"","value":"","submit":false,"completion_reply":"I ..."}}'
                    )
                    events = model.stream(
                        messages=[Message(role="user", content=verify_prompt)],
                        image_base64=ctx.get("screenshot_base64"),
                    )
                    llm_text = "".join([self._extract_stream_text(ev) async for ev in events])
                    parsed = self._parse_json_plan(llm_text)
                    if parsed:
                        if parsed.get("completion_reply"):
                            verified_completion_reply = re.sub(
                                r"\[?elem_\d+\]?\s*", "", str(parsed["completion_reply"])
                            ).strip()

                        if parsed.get("goal_achieved") is False:
                            act_str = str(parsed.get("action", "")).upper()
                            eid = str(parsed.get("element_id", "")).strip()
                            matched = next((e for e in elements if e.get("element_id") == eid), None)

                            next_val = str(parsed.get("value", "")).strip() or None
                            last_step = action_history[-1] if action_history else {}
                            is_repeat = (
                                matched
                                and (matched.get("accessible_name") or matched.get("text")) == last_step.get("target")
                                and act_str == last_step.get("action")
                                and ctx.get("url") == last_step.get("url_after")
                            )

                            if not is_repeat:
                                next_action_obj: Optional[BrowserAction] = None
                                next_label = ""
                                if act_str == "NAVIGATE" and next_val:
                                    next_action_obj = BrowserAction(
                                        action_id=f"act_{uuid.uuid4().hex[:8]}",
                                        type=ActionType.NAVIGATE,
                                        value=next_val,
                                        reason="Continuing navigation",
                                    )
                                    next_label = next_val
                                elif act_str == "SCROLL":
                                    next_action_obj = BrowserAction(
                                        action_id=f"act_{uuid.uuid4().hex[:8]}",
                                        type=ActionType.SCROLL,
                                        options={"deltaY": int(parsed.get("deltaY", 500))},
                                        reason="Scrolling to locate target",
                                    )
                                    next_label = "Scroll"
                                elif matched:
                                    is_fill = "FILL" in act_str or matched.get("tag") in ["input", "textarea"]
                                    if matched.get("tag") in ["button", "a"] or matched.get("role") in ["button", "link"]:
                                        is_fill = False
                                    next_label = (
                                        matched.get("accessible_name")
                                        or matched.get("text")
                                        or matched.get("placeholder")
                                        or "control"
                                    )
                                    next_action_obj = BrowserAction(
                                        action_id=f"act_{uuid.uuid4().hex[:8]}",
                                        type=ActionType.FILL if is_fill else ActionType.CLICK,
                                        target=BrowserActionTarget(
                                            element_id=matched.get("element_id"),
                                            selector=matched.get("selector"),
                                            accessible_name=next_label,
                                            role=matched.get("role") or matched.get("tag"),
                                        ),
                                        value=next_val if is_fill else None,
                                        options={"submit": bool(parsed.get("submit")), "submit_search": bool(parsed.get("submit"))}
                                        if is_fill and parsed.get("submit")
                                        else {},
                                        reason=f"Continuing task on {next_label}",
                                    )

                                if next_action_obj:
                                    next_action_obj = PolicyEngine.evaluate(next_action_obj, target_text=next_label)
                                    if not next_action_obj.requires_approval or approved:
                                        self._task_state[task_id] = {
                                            "step_count": step_count + 1,
                                            "history": action_history,
                                            "last_action_type": next_action_obj.type.value,
                                            "last_target_label": next_label,
                                            "last_value": next_action_obj.value or "",
                                            "completion_reply": verified_completion_reply or f"Done — I completed '{user_request}'.",
                                        }
                                        return TaskResponse(
                                            task_id=task_id,
                                            state=TaskState.WAITING_FOR_ACTION,
                                            mode=mode,
                                            user_request=user_request,
                                            plan=plan,
                                            current_action=next_action_obj,
                                            message="",
                                        )
                except Exception as verify_err:
                    logger.info(f"[Recare] Verification loop note: {verify_err}")

            self._task_state.pop(task_id, None)
            completion_reply = verified_completion_reply
            if not completion_reply:
                changes = last_action_result.observed_changes or {}
                if changes.get("url_changed") and last_action_result.current_url:
                    completion_reply = f"Done — I opened {ctx.get('title') or last_action_result.current_url} for you."
                else:
                    completion_reply = f"Done — I completed that on '{ctx.get('title', 'the page')}'."

            completion_reply = re.sub(r"\[?elem_\d+\]?\s*", "", completion_reply).strip()
            logger.info(f"[Recare Tool Feedback] {completion_reply}")

            for p in plan:
                p.status = "COMPLETED"

            return TaskResponse(
                task_id=task_id,
                state=TaskState.COMPLETED,
                mode=mode,
                user_request=user_request,
                plan=plan,
                message=completion_reply,
                completion_summary=completion_reply,
            )

        # Helper to finalize & return a browser action with stored plain-language completion reply
        def _build_action_response(
            action_obj: BrowserAction,
            completion_reply: str,
            target_label: Optional[str] = None,
            extra_meta: Optional[Dict[str, Any]] = None,
        ) -> TaskResponse:
            evaluated = PolicyEngine.evaluate(action_obj, target_text=target_label)
            if evaluated.requires_approval and not approved:
                approval_req = ApprovalRequest(
                    approval_id=f"appr_{uuid.uuid4().hex[:8]}",
                    task_id=task_id,
                    action_id=evaluated.action_id,
                    action_type=evaluated.type.value,
                    risk_level=RiskLevel(evaluated.risk_level),
                    target_description=f"{evaluated.type.value} on '{target_label or 'element'}'",
                    reason=evaluated.reason,
                    affected_domain=ctx.get("domain"),
                    data_payload=evaluated.value,
                )
                return TaskResponse(
                    task_id=task_id,
                    state=TaskState.WAITING_FOR_USER_APPROVAL,
                    mode=mode,
                    user_request=user_request,
                    plan=plan,
                    current_action=evaluated,
                    pending_approval=approval_req,
                    message="Please confirm if you want me to proceed with this step.",
                )

            state_payload: Dict[str, Any] = {
                "step_count": 1,
                "history": [],
                "last_action_type": evaluated.type.value,
                "last_target_label": target_label or "",
                "last_value": evaluated.value or "",
                "completion_reply": completion_reply,
            }
            if extra_meta:
                state_payload.update(extra_meta)
            self._task_state[task_id] = state_payload
            return TaskResponse(
                task_id=task_id,
                state=TaskState.WAITING_FOR_ACTION,
                mode=mode,
                user_request=user_request,
                plan=plan,
                current_action=evaluated,
                message="",
            )

        req_lower = user_request.lower().strip()

        # Agentic Web Research & Document Generation Task
        is_task_research_doc = (
            any(k in req_lower for k in ["research", "investigate", "study", "analysis", "deep dive"])
            and any(k in req_lower for k in ["doc", "document", "file", "download", "report", "paper", "notes"])
        ) or any(k in req_lower for k in ["send me the doc", "send me the file", "download the file", "create a report", "generate a doc"])

        if is_task_research_doc:
            from app.agent.tools.web_search_tools import search_web_for_information
            topic = re.sub(
                r"\b(can you|please|i want to|could you|do a|do|research|about|on|and|send me the doc|send me a doc|send the file to me|send me the file|download it|generate|prepare|create|file|doc|document|notes|report)\b",
                " ",
                req_lower,
                flags=re.IGNORECASE
            ).strip() or "Research"
            web_info = ""
            try:
                web_info = search_web_for_information(topic)
            except Exception:
                pass

            from app.agent.models import get_model
            model = get_model(settings.MODEL_PROVIDER, settings.MODEL_NAME)
            doc_prompt = (
                f"You are Recare, an autonomous AI research agent.\n"
                f"Task: Generate a comprehensive, professional, well-structured research document on: '{topic}'.\n"
                f"Online search findings:\n{web_info or 'Provide exhaustive, accurate knowledge.'}\n\n"
                f"Structure the document in clean Markdown with:\n"
                f"# Research Report: {topic.title()}\n"
                f"## 1. Executive Summary\n"
                f"## 2. Key Highlights & Findings\n"
                f"## 3. In-Depth Analysis\n"
                f"## 4. Key Takeaways & Recommendations\n"
                f"## 5. Sources & References\n\n"
                f"Make it high quality, detailed, and directly downloadable."
            )
            doc_content = ""
            try:
                from strands.types.content import Message
                events = model.stream(messages=[Message(role="user", content=doc_prompt)])
                doc_content = "".join([self._extract_stream_text(ev) async for ev in events]).strip()
            except Exception:
                pass

            if not doc_content:
                doc_content = f"# Research Report: {topic.title()}\n\n## 1. Executive Summary\nSummary of findings on {topic}.\n\n## 2. Key Findings\n{web_info or 'General knowledge synthesis.'}"

            clean_slug = re.sub(r"[^a-zA-Z0-9_]+", "_", topic.lower()).strip("_")[:30] or "research"
            gen_doc = {
                "title": f"Research Report: {topic.title()}",
                "filename": f"recare_research_{clean_slug}.md",
                "content": doc_content,
                "mime_type": "text/markdown",
            }
            completion_msg = f"I have conducted research on **{topic.title()}** and compiled your research report. You can download the document below."
            for p in plan:
                p.status = "COMPLETED"
            return TaskResponse(
                task_id=task_id,
                state=TaskState.COMPLETED,
                mode=mode,
                user_request=user_request,
                plan=plan,
                message=completion_msg,
                completion_summary=completion_msg,
                generated_document=gen_doc,
            )

        # Direct Google / Web Search intent
        if re.search(r"\b(search (?:on )?google|google for|look up on google|search the web for|search online for)\b", req_lower):
            g_query = self._extract_search_query(user_request)
            if g_query and g_query.lower() not in {"it", "that", "something", "this", "anything", "stuff"}:
                return _build_action_response(
                    BrowserAction(
                        action_id=f"act_{uuid.uuid4().hex[:8]}",
                        type=ActionType.NAVIGATE,
                        value=f"https://www.google.com/search?q={urllib.parse.quote(g_query)}",
                        reason=f"Searching for '{g_query}' on Google",
                    ),
                    completion_reply=f"Done — I searched for '{g_query}' on Google for you.",
                    target_label=f"Google Search: {g_query}",
                )

        # 0. Direct Browser-Level Navigation, Tabs, & Scrolling Intents
        if re.search(r"\b(open (?:a )?new tab|new tab|create (?:a )?new tab|play new tab)\b", req_lower):
            return _build_action_response(
                BrowserAction(
                    action_id=f"act_{uuid.uuid4().hex[:8]}",
                    type=ActionType.NAVIGATE,
                    value="__NEW_TAB__",
                    reason="Opening a new browser tab",
                ),
                completion_reply="I opened a new tab for you.",
                target_label="New Tab",
            )

        if re.search(r"\b(open (?:the )?front page|front page|go to (?:the )?home page|home page|homepage|go home)\b", req_lower):
            home_el = next(
                (e for e in elements if (e.get("accessible_name") or e.get("text") or "").strip().lower() in ["home", "front page"]),
                None,
            )
            if not home_el:
                home_el = next(
                    (e for e in elements if e.get("href") in ["/", f"https://{ctx.get('domain')}/", f"https://www.{ctx.get('domain')}/"]),
                    None,
                )
            if home_el:
                return _build_action_response(
                    BrowserAction(
                        action_id=f"act_{uuid.uuid4().hex[:8]}",
                        type=ActionType.CLICK,
                        target=BrowserActionTarget(
                            element_id=home_el.get("element_id"),
                            selector=home_el.get("selector"),
                            accessible_name="Home",
                            role=home_el.get("role") or "link",
                        ),
                        reason="Navigating to home page",
                    ),
                    completion_reply="I opened the front page for you.",
                    target_label="Home",
                )
            return _build_action_response(
                BrowserAction(
                    action_id=f"act_{uuid.uuid4().hex[:8]}",
                    type=ActionType.NAVIGATE,
                    value="__HOME__",
                    reason="Navigating to front page",
                ),
                completion_reply="I opened the front page for you.",
                target_label="Front Page",
            )

        if re.search(r"\b(go back|take me back|previous page|navigate back|back page)\b", req_lower) or (
            "didn't" in req_lower and ("back" in req_lower or not elements)
        ):
            return _build_action_response(
                BrowserAction(
                    action_id=f"act_{uuid.uuid4().hex[:8]}",
                    type=ActionType.NAVIGATE,
                    value="__BACK__",
                    reason="Going back to the previous page",
                ),
                completion_reply="I took you back to the previous page.",
                target_label="Browser Back",
            )

        if re.search(r"\b(go forward|forward page|navigate forward)\b", req_lower):
            return _build_action_response(
                BrowserAction(
                    action_id=f"act_{uuid.uuid4().hex[:8]}",
                    type=ActionType.NAVIGATE,
                    value="__FORWARD__",
                    reason="Moving forward to the next page",
                ),
                completion_reply="I moved forward to the next page.",
                target_label="Browser Forward",
            )

        if re.search(r"\b(refresh page|reload page|refresh this|reload this)\b", req_lower):
            return _build_action_response(
                BrowserAction(
                    action_id=f"act_{uuid.uuid4().hex[:8]}",
                    type=ActionType.NAVIGATE,
                    value="__RELOAD__",
                    reason="Refreshing the page",
                ),
                completion_reply="I refreshed the page for you.",
                target_label="Reload",
            )

        if re.search(r"\b(scroll down|page down|move down)\b", req_lower):
            return _build_action_response(
                BrowserAction(
                    action_id=f"act_{uuid.uuid4().hex[:8]}",
                    type=ActionType.SCROLL,
                    options={"deltaY": 550},
                    reason="Scrolling down",
                ),
                completion_reply="I scrolled down the page.",
                target_label="Scroll Down",
            )

        if re.search(r"\b(scroll up|page up|scroll to top|back to top)\b", req_lower):
            return _build_action_response(
                BrowserAction(
                    action_id=f"act_{uuid.uuid4().hex[:8]}",
                    type=ActionType.SCROLL,
                    options={"deltaY": -550},
                    reason="Scrolling up",
                ),
                completion_reply="I scrolled up the page.",
                target_label="Scroll Up",
            )

        candidate_el = None
        action_type = ActionType.CLICK
        val: Optional[str] = None
        action_options: Dict[str, Any] = {}
        completion_reply: Optional[str] = None
        extra_meta: Dict[str, Any] = {}

        action_keywords = {
            "click", "press", "tap", "fill", "type", "enter", "submit", "navigate",
            "go", "open", "scroll", "select", "choose", "signin", "sign in", "login",
            "log in", "download", "search", "find", "get", "register", "buy", "order",
            "play", "watch", "load", "account", "back", "forward", "close", "dismiss",
        }
        has_action_intent = any(k in req_lower for k in action_keywords) or any(
            k in req_lower for k in ["click on", "fill in", "type in", "press the", "want to", "help me"]
        )

        STOP_WORDS = {
            "help", "this", "page", "that", "with", "from", "some", "want", "need",
            "like", "please", "could", "would", "should", "tell", "about", "your",
            "what", "where", "when", "there", "here", "just", "the", "and", "for", "can", "you",
            "click", "press", "tap", "open", "select", "button", "link", "tab", "on", "it", "to", "at"
        }

        if not has_action_intent and not any(k in req_lower for k in ["fill", "enter", "type", "click"]):
            from app.agent.models import get_model
            model = get_model(settings.MODEL_PROVIDER, settings.MODEL_NAME)
            conv_reply = None
            try:
                from strands.types.content import Message
                events = model.stream(
                    messages=[Message(role="user", content=user_request)],
                    system_prompt=f"You are Recare, an AI browser assistant on page '{ctx.get('title', 'Webpage')}'. Respond helpfully and concisely in 1-2 natural plain sentences."
                )
                chunks = [self._extract_stream_text(ev) async for ev in events]
                text = "".join(chunks).strip()
                if text:
                    conv_reply = text
            except Exception as e:
                logger.warning(f"Error querying model: {e}")

            if not conv_reply or "Analyzed request" in conv_reply:
                conv_reply = "AI model is currently not available."

            return TaskResponse(
                task_id=task_id,
                state=TaskState.COMPLETED,
                mode=mode,
                user_request=user_request,
                plan=plan,
                message=conv_reply,
                completion_summary="Conversational response provided.",
            )

        # 1. Structured JSON LLM-driven agentic planning
        from app.agent.models import get_model
        model = get_model(settings.MODEL_PROVIDER, settings.MODEL_NAME)
        elements_summary = "\n".join([
            f"[{e.get('element_id')}] <{e.get('tag')} type='{e.get('input_type', '')}'> text='{e.get('accessible_name') or e.get('text') or ''}' placeholder='{e.get('placeholder', '')}' href='{e.get('href', '')}'"
            for e in elements[:35]
        ])

        try:
            from strands.types.content import Message
            agent_prompt = (
                f"You are Recare, an autonomous browser agent with full search and browsing capabilities.\n"
                f"User Request: \"{user_request}\"\n"
                f"Current Page: \"{ctx.get('title', '')}\" ({ctx.get('url', '')})\n"
                f"Controls:\n{elements_summary}\n\n"
                f"Choose the single best browser operation to fulfill the user's request.\n"
                f"Rules:\n"
                f"- For searching: If a search <input> or text input is visible on the page, choose action 'FILL' on that element, set 'value' to the query, and set 'submit': true.\n"
                f"- If a search button or search icon is present on the page (e.g. button with text/label 'Search'), you MUST choose 'CLICK' on that matching element_id to open the site's search bar.\n"
                f"- Only if there is NO search input and NO search button on the current page (or user explicitly asks to search Google/the web): choose action 'NAVIGATE' with 'value': 'https://www.google.com/search?q=<query_encoded>' to perform the search directly on Google in the browser.\n"
                f"- For going back/forward/reloading, choose 'NAVIGATE' with 'value': '__BACK__', '__FORWARD__', or '__RELOAD__'.\n"
                f"- For clicking links/buttons/closing modals, choose 'CLICK' on the matching element_id.\n"
                f"- Write 'completion_reply' in warm, simple past tense confirming the result (never mention element IDs or technical steps).\n"
                f"Return strict JSON only:\n"
                f'{{"action":"CLICK|FILL|NAVIGATE|SCROLL","element_id":"elem_1","value":"","submit":false,"deltaY":500,"completion_reply":"I did ..."}}'
            )
            events = model.stream(
                messages=[Message(role="user", content=agent_prompt)],
                image_base64=ctx.get("screenshot_base64"),
            )
            llm_text = "".join([self._extract_stream_text(ev) async for ev in events])
            parsed = self._parse_json_plan(llm_text)
            if parsed:
                act_str = str(parsed.get("action", "")).upper()
                if act_str == "NAVIGATE" and parsed.get("value"):
                    target_url = str(parsed["value"])
                    # If LLM proposed external search navigation but the current page already has a Search button or input,
                    # and user did not specifically ask for Google/web search, prioritize the page's search control!
                    search_btn_on_page = next(
                        (e for e in elements if "search" in f"{e.get('accessible_name', '')} {e.get('text', '')}".lower()),
                        None
                    )
                    user_wants_external = any(w in req_lower for w in ["google", "the web", "online", "externally"])
                    if "google.com/search" in target_url and search_btn_on_page and not user_wants_external:
                        candidate_el = search_btn_on_page
                        action_type = ActionType.FILL if search_btn_on_page.get("tag") in ["input", "textarea"] else ActionType.CLICK
                        if action_type == ActionType.FILL:
                            val = self._extract_search_query(user_request)
                            action_options = {"submit": True, "submit_search": True}
                        else:
                            extra_meta["follow_up_search_query"] = self._extract_search_query(user_request)
                        completion_reply = str(parsed.get("completion_reply") or f"I opened {search_btn_on_page.get('accessible_name') or 'Search'} for you.")
                    else:
                        label = "Google Search" if "google.com/search" in target_url else target_url
                        return _build_action_response(
                            BrowserAction(
                                action_id=f"act_{uuid.uuid4().hex[:8]}",
                                type=ActionType.NAVIGATE,
                                value=target_url,
                                reason=str(parsed.get("completion_reply") or f"Navigating to {label}"),
                            ),
                            completion_reply=str(parsed.get("completion_reply") or f"I searched for your query for you."),
                            target_label=label,
                        )
                if act_str == "SCROLL":
                    return _build_action_response(
                        BrowserAction(
                            action_id=f"act_{uuid.uuid4().hex[:8]}",
                            type=ActionType.SCROLL,
                            options={"deltaY": int(parsed.get("deltaY", 500))},
                            reason="Scrolling page",
                        ),
                        completion_reply=str(parsed.get("completion_reply") or "I scrolled the page for you."),
                        target_label="Scroll",
                    )

                eid = str(parsed.get("element_id", "")).strip()
                matched = next((e for e in elements if e.get("element_id") == eid), None)
                if matched:
                    candidate_el = matched
                    action_type = ActionType.FILL if "FILL" in act_str else ActionType.CLICK
                    val = str(parsed.get("value", "")).strip() or None
                    if parsed.get("submit"):
                        action_options["submit"] = True
                        action_options["submit_search"] = True
                    completion_reply = str(parsed.get("completion_reply") or "").strip() or None
                    if action_type == ActionType.CLICK and ("search" in req_lower or "look up" in req_lower):
                        is_search_toggle = "search" in f"{matched.get('accessible_name', '')} {matched.get('text', '')}".lower()
                        if is_search_toggle:
                            extra_meta["follow_up_search_query"] = self._extract_search_query(user_request)
        except Exception as e:
            logger.info(f"LLM planning fallback to intent heuristic: {e}")

        # 2. Smart Heuristic Fallback if LLM didn't match a concrete element
        if not candidate_el:
            if "search" in req_lower or "look up" in req_lower or "find" in req_lower:
                query = self._extract_search_query(user_request)
                is_generic = (
                    not query
                    or query.lower() in {"it", "that", "something", "this", "anything", "stuff", user_request.lower()}
                )
                inputs = [
                    e for e in elements
                    if e.get("tag") in ["input", "textarea"]
                    and e.get("input_type") not in ["password", "hidden", "checkbox", "radio", "submit"]
                ]
                inputs.sort(
                    key=lambda e: 0
                    if (
                        e.get("input_type") == "search"
                        or "search" in f"{e.get('accessible_name', '')} {e.get('placeholder', '')}".lower()
                    )
                    else 1
                )
                if inputs:
                    candidate_el = inputs[0]
                    if is_generic:
                        action_type = ActionType.CLICK
                        completion_reply = "I opened and focused the search bar for you. What would you like to search for?"
                    else:
                        action_type = ActionType.FILL
                        val = query
                        action_options = {"submit": True, "submit_search": True}
                        completion_reply = f"Done — I searched for '{query}' for you."
                else:
                    # Try opening a search icon/toggle first and queue follow-up search!
                    for el in elements:
                        txt = f"{el.get('accessible_name', '')} {el.get('text', '')} {el.get('href', '')}".lower()
                        if "search" in txt:
                            candidate_el = el
                            action_type = ActionType.CLICK
                            if not is_generic:
                                extra_meta["follow_up_search_query"] = query
                                completion_reply = f"Done — I searched for '{query}' for you."
                            else:
                                completion_reply = "I opened the search bar for you. What would you like to search for?"
                            break

                    # If no search element exists on the active page, CREATE the search action by navigating directly to Google!
                    if not candidate_el:
                        if not is_generic and query:
                            return _build_action_response(
                                BrowserAction(
                                    action_id=f"act_{uuid.uuid4().hex[:8]}",
                                    type=ActionType.NAVIGATE,
                                    value=f"https://www.google.com/search?q={urllib.parse.quote(query)}",
                                    reason=f"Searching for '{query}' on Google",
                                ),
                                completion_reply=f"Done — I searched for '{query}' on Google for you.",
                                target_label=f"Google Search: {query}",
                            )
                        else:
                            return _build_action_response(
                                BrowserAction(
                                    action_id=f"act_{uuid.uuid4().hex[:8]}",
                                    type=ActionType.NAVIGATE,
                                    value="https://www.google.com",
                                    reason="Opening Google Search in browser",
                                ),
                                completion_reply="I opened Google Search for you. What would you like to search for?",
                                target_label="Google Search",
                            )

            elif any(k in req_lower for k in ["signin", "sign in", "login", "log in", "account"]):
                for el in elements:
                    txt = f"{el.get('accessible_name', '')} {el.get('text', '')} {el.get('href', '')}".lower()
                    if any(k in txt for k in ["signin", "sign in", "login", "log in", "account", "user"]):
                        candidate_el = el
                        action_type = ActionType.CLICK
                        completion_reply = f"I opened {el.get('accessible_name') or 'Sign In'} for you."
                        break

            elif "download" in req_lower:
                for el in elements:
                    txt = f"{el.get('accessible_name', '')} {el.get('text', '')} {el.get('href', '')}".lower()
                    if any(k in txt for k in ["download", "get", "torrent", "magnet"]):
                        candidate_el = el
                        action_type = ActionType.CLICK
                        completion_reply = f"I clicked {el.get('accessible_name') or 'Download'} for you."
                        break

            elif any(k in req_lower for k in ["fill", "enter", "type"]):
                inputs = [
                    e for e in elements
                    if e.get("tag") in ["input", "textarea"] and e.get("input_type") != "password"
                ]
                if inputs:
                    candidate_el = inputs[0]
                    action_type = ActionType.FILL
                    val = self._extract_search_query(user_request)
                    completion_reply = f"I entered '{val}' into the field for you."

            if not candidate_el:
                meaningful_words = [w for w in re.findall(r"[a-z0-9]+", req_lower) if len(w) > 2 and w not in STOP_WORDS]
                best_match = None
                best_score = 0
                for el in elements:
                    acc_name = (el.get("accessible_name") or el.get("text") or "").strip().lower()
                    href = (el.get("href") or "").strip().lower()
                    score = 0
                    for w in meaningful_words:
                        if acc_name == w:
                            score += 10
                        elif re.search(rf"\b{re.escape(w)}\b", acc_name):
                            score += 6
                        elif w in acc_name:
                            score += 3
                        elif w in href:
                            score += 1
                    if score > best_score:
                        best_score = score
                        best_match = el

                if best_match and best_score > 0:
                    candidate_el = best_match
                    label = candidate_el.get("accessible_name") or candidate_el.get("text") or "that control"
                    completion_reply = f"I opened '{label}' for you."

        if not candidate_el:
            return TaskResponse(
                task_id=task_id,
                state=TaskState.COMPLETED,
                mode=mode,
                user_request=user_request,
                plan=plan,
                message=f"I couldn't find that control on this page. Would you like me to describe what is visible here instead?",
                completion_summary="No matching target element found.",
            )

        # Enforce CLICK for buttons/links, FILL for text inputs
        if candidate_el.get("tag") in ["button", "a"] or candidate_el.get("role") in ["button", "link"]:
            action_type = ActionType.CLICK
        elif candidate_el.get("tag") in ["input", "textarea"] and val is not None:
            action_type = ActionType.FILL

        label = candidate_el.get("accessible_name") or candidate_el.get("text") or candidate_el.get("placeholder") or "the control"
        final_reply = completion_reply or (
            f"I entered '{val}' and submitted." if action_type == ActionType.FILL and action_options.get("submit")
            else f"I filled in {label}." if action_type == ActionType.FILL
            else f"I opened {label} for you."
        )

        return _build_action_response(
            BrowserAction(
                action_id=f"act_{uuid.uuid4().hex[:8]}",
                type=action_type,
                target=BrowserActionTarget(
                    element_id=candidate_el.get("element_id"),
                    selector=candidate_el.get("selector"),
                    accessible_name=label,
                    role=candidate_el.get("role") or candidate_el.get("tag"),
                ),
                value=val,
                options=action_options,
                reason=f"Operating {label}",
            ),
            completion_reply=final_reply,
            target_label=label,
            extra_meta=extra_meta,
        )
