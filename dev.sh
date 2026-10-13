#!/usr/bin/env bash
# Runs backend + frontend together for local development.
# Ctrl+C stops both.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

if [ ! -f .env ]; then
  echo "No .env found — copying from .env.example."
  echo "Fill in GEMINI_API_KEY / APIFY_API_TOKEN before the backend will fully work."
  cp .env.example .env
fi

cleanup() {
  echo
  echo "Stopping..."
  pkill -TERM -f "main.py" 2>/dev/null
  pkill -TERM -f "node_modules/.bin/vite" 2>/dev/null
  sleep 1
  pkill -KILL -f "main.py" 2>/dev/null
  pkill -KILL -f "node_modules/.bin/vite" 2>/dev/null
  exit 0
}
trap cleanup INT TERM

echo "Starting backend (uv run python main.py)..."
uv run python main.py &

cd frontend
echo "Starting frontend (npm run dev)..."
npm run dev &
cd "$ROOT"

cat <<EOF

Backend:  http://localhost:8888
Frontend: http://localhost:5173  (proxies /api to the backend — use this one)
Press Ctrl+C to stop both.

EOF

wait
