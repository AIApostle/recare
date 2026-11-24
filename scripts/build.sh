#!/usr/bin/env bash
set -e

echo "=== Building Recare Monorepo ==="
echo "Building Chrome Extension with WXT..."
pnpm --filter @recare/extension build

echo "Syncing Python Backend with uv..."
(cd backend && uv sync)

echo "=== Build Complete! Extension bundle located at: apps/extension/.output/chrome-mv3 ==="
