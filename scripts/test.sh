#!/usr/bin/env bash
set -e

echo "=== Running Recare Test Suites ==="
echo "1. Running Extension DOM & Executor Vitest Suite..."
pnpm --filter @recare/extension test

echo "2. Running Playwright End-to-End Chrome Browser Suite..."
pnpm --filter @recare/extension test:e2e

echo "3. Running Backend FastAPI & Policy Pytest Suite..."
(cd backend && uv run pytest)

echo "=== All Tests (Vitest + Playwright + Pytest) Passed Successfully! ==="
