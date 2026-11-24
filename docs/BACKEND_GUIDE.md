# Recare Backend Guide

## Starting the Backend

The backend is managed with `uv` (modern Python package manager):

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

The API will be available at `http://127.0.0.1:8000`.
Interactive Swagger API documentation is accessible at `http://127.0.0.1:8000/docs`.

## API Endpoints

- `GET /health`: Health check and model provider status.
- `POST /api/v1/tasks`: Initialize a new task with user request and active page context.
- `GET /api/v1/tasks/{task_id}`: Retrieve task status, plan steps, and completion records.
- `POST /api/v1/tasks/{task_id}/action-result`: Submit executed action result from extension.
- `POST /api/v1/tasks/{task_id}/approve`: Submit user confirmation for consequential actions.
- `POST /api/v1/tasks/{task_id}/cancel`: Immediately stop and terminate an active task.
- `POST /api/v1/chat`: Context-grounded conversational questions and interface explanations.
- `GET /api/v1/user/preferences`: Retrieve persisted accessibility preferences.
- `PUT /api/v1/user/preferences`: Update accessibility settings.

## Model Configuration

In `backend/.env`:
```ini
MODEL_PROVIDER=mock       # mock, openai, anthropic, gemini, bedrock
MODEL_NAME=mock-agent-v1
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GEMINI_API_KEY=
```
`mock` provider is configured out of the box so full testing and development work without external API keys.
