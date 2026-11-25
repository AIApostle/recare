import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.database.session import init_db

@pytest_asyncio.fixture(autouse=True)
async def setup_database():
    await init_db()

@pytest.mark.asyncio
async def test_health_check():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        for path in ["/health", "/healthz", "/api/v1/health"]:
            response = await client.get(path)
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "healthy"
            assert "Recare" in data["service"]
            assert "gemini_configured" in data
        head_res = await client.head("/health")
        assert head_res.status_code == 200

@pytest.mark.asyncio
async def test_chat_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "message": "What am I looking at?",
            "page_context": {
                "url": "https://example.com/dashboard",
                "domain": "example.com",
                "title": "Invoicing Portal",
                "headings": [{"level": 1, "text": "Invoices"}],
                "interactive_elements": [
                    {
                        "element_id": "elem_1",
                        "tag": "button",
                        "role": "button",
                        "accessible_name": "Create Invoice",
                        "text": "Create Invoice",
                        "is_visible": True,
                        "is_enabled": True
                    }
                ]
            },
            "mode": "guide",
            "conversation_history": [
                {"role": "user", "content": "Hello"},
                {"role": "assistant", "content": "Hi! How can I help you today?"}
            ]
        }
        response = await client.post("/api/v1/chat", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert len(data["reply"]) > 0
        assert len(data["suggested_actions"]) > 0

        transcribe_res = await client.post("/api/v1/chat/transcribe", json={"audio_base64": ""})
        assert transcribe_res.status_code == 200
        assert transcribe_res.json()["transcript"] == ""

@pytest.mark.asyncio
async def test_task_creation_and_lifecycle():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "user_request": "Click the Create Invoice button",
            "mode": "assist",
            "page_context": {
                "url": "https://example.com/dashboard",
                "domain": "example.com",
                "title": "Invoicing Portal",
                "headings": [{"level": 1, "text": "Invoices"}],
                "interactive_elements": [
                    {
                        "element_id": "btn_create",
                        "tag": "button",
                        "role": "button",
                        "accessible_name": "Create Invoice",
                        "text": "Create Invoice",
                        "is_visible": True,
                        "is_enabled": True
                    }
                ]
            }
        }
        # 1. Create task
        res = await client.post("/api/v1/tasks", json=payload)
        assert res.status_code == 201
        data = res.json()
        task_id = data["task_id"]
        assert task_id is not None
        assert data["state"] == "WAITING_FOR_ACTION"
        assert data["current_action"] is not None
        assert data["current_action"]["type"] == "CLICK"
        action_id = data["current_action"]["action_id"]

        # 2. Get task
        get_res = await client.get(f"/api/v1/tasks/{task_id}")
        assert get_res.status_code == 200
        assert get_res.json()["task_id"] == task_id

        # 3. Submit action result (simulating extension executing the click)
        result_payload = {
            "action_result": {
                "action_id": action_id,
                "success": True,
                "current_url": "https://example.com/invoices/new",
                "observed_changes": {"modal_opened": True}
            }
        }
        res_submit = await client.post(f"/api/v1/tasks/{task_id}/action-result", json=result_payload)
        assert res_submit.status_code == 200
        completed_data = res_submit.json()
        assert completed_data["state"] == "COMPLETED"

        # 4. Cancel task
        cancel_res = await client.post(f"/api/v1/tasks/{task_id}/cancel")
        assert cancel_res.status_code == 200
        assert cancel_res.json()["state"] == "CANCELLED"

        # 5. List tasks
        list_res = await client.get("/api/v1/tasks?limit=10")
        assert list_res.status_code == 200
        tasks = list_res.json()
        assert isinstance(tasks, list)
        assert len(tasks) >= 1
        assert any(t["task_id"] == task_id for t in tasks)

        # 6. Stream events
        stream_res = await client.get(f"/api/v1/tasks/{task_id}/events")
        assert stream_res.status_code == 200
        assert "text/event-stream" in stream_res.headers.get("content-type", "")


@pytest.mark.asyncio
async def test_back_navigation_and_multistep_search():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Back navigation intent
        back_res = await client.post("/api/v1/tasks", json={
            "user_request": "okay take me back",
            "mode": "assist",
            "page_context": {"url": "https://thenkiri.com", "domain": "thenkiri.com", "title": "Nkiri", "headings": [], "interactive_elements": []},
        })
        assert back_res.status_code == 201
        back_data = back_res.json()
        assert back_data["current_action"]["type"] == "NAVIGATE"
        assert back_data["current_action"]["value"] == "__BACK__"

        # 2. Search toggle click -> revealed search input fill & submit multi-step loop
        search_res = await client.post("/api/v1/tasks", json={
            "user_request": "I want to search for The Social Network can you search for it for me",
            "mode": "assist",
            "page_context": {
                "url": "https://thenkiri.com",
                "domain": "thenkiri.com",
                "title": "Nkiri",
                "headings": [],
                "interactive_elements": [
                    {"element_id": "elem_3", "tag": "button", "role": "button", "accessible_name": "Search", "is_visible": True, "is_enabled": True}
                ],
            },
        })
        assert search_res.status_code == 201
        s_data = search_res.json()
        assert s_data["state"] == "WAITING_FOR_ACTION"
        assert s_data["current_action"]["type"] == "CLICK"

        step2_res = await client.post(f"/api/v1/tasks/{s_data['task_id']}/action-result", json={
            "action_result": {"action_id": s_data["current_action"]["action_id"], "success": True},
            "page_context": {
                "url": "https://thenkiri.com",
                "domain": "thenkiri.com",
                "title": "Nkiri",
                "headings": [],
                "interactive_elements": [
                    {"element_id": "elem_4", "tag": "input", "input_type": "search", "placeholder": "Search...", "is_visible": True, "is_enabled": True}
                ],
            },
        })
        assert step2_res.status_code == 200
        s2_data = step2_res.json()
        assert s2_data["state"] == "WAITING_FOR_ACTION"
        assert s2_data["current_action"]["type"] == "FILL"
        assert s2_data["current_action"]["value"] == "The Social Network"
        assert s2_data["current_action"]["options"]["submit"] is True


def test_websocket_realtime_channel():
    from starlette.testclient import TestClient
    with TestClient(app) as client:
        with client.websocket_connect("/api/v1/ws") as ws:
            ws.send_json({"type": "ping", "request_id": "p1"})
            pong = ws.receive_json()
            assert pong["type"] == "pong"
            assert pong["request_id"] == "p1"

            ws.send_json({
                "type": "chat",
                "request_id": "c1",
                "message": "where am i?",
                "page_context": {
                    "url": "https://thenkiri.com",
                    "domain": "thenkiri.com",
                    "title": "Welcome To Nkiri",
                    "headings": [],
                    "interactive_elements": [
                        {"element_id": "elem_4", "tag": "a", "accessible_name": "Home", "is_visible": True, "is_enabled": True}
                    ],
                },
            })
            frame1 = ws.receive_json()
            assert frame1["type"] == "status"
            frame2 = ws.receive_json()
            assert frame2["type"] == "chat_response"
            assert "[elem_4]" not in frame2["data"]["reply"]
