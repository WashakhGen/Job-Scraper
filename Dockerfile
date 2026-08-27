# ── Frontend build ──────────────────────────────────
FROM node:22-alpine AS frontend

WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# ── Backend runtime ─────────────────────────────────
FROM python:3.12-slim AS runtime

COPY --from=ghcr.io/astral-sh/uv:0.9 /uv /uvx /usr/local/bin/

WORKDIR /app
ENV UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never \
    PYTHONUNBUFFERED=1 \
    PATH="/app/.venv/bin:$PATH"

# dependencies first — this layer only rebuilds when pyproject.toml/uv.lock change
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY backend/ backend/
COPY core/ core/
COPY main.py ./
COPY --from=frontend /app/frontend/dist frontend/dist

# default data dirs — overridden by DATABASE_URL/CV_UPLOAD_DIR/LOG_DIR at runtime
# when a volume is mounted elsewhere (see docker-compose.yml)
RUN mkdir -p media/cvs logs

EXPOSE 8888

CMD ["python", "main.py"]
