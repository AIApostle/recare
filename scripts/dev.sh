#!/usr/bin/env bash
set -e

echo "=== Starting Recare Development Services ==="
echo "1. Starting Backend API at http://127.0.0.1:8000 ..."
(cd backend && uv run uvicorn app.main:app --reload --port 8000) &
BACKEND_PID=$!

echo "2. Starting Demo Test Bench at http://localhost:3000 ..."
python3 -m http.server 3000 --directory apps/web/public &
DEMO_PID=$!

echo "3. Starting Extension Development Watcher..."
pnpm --filter @recare/extension dev &
EXT_PID=$!

trap "kill $BACKEND_PID $DEMO_PID $EXT_PID 2>/dev/null || true" EXIT INT TERM

wait
