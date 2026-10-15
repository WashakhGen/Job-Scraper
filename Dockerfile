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


RUN apt-get update && apt-get install -y --no-install-recommends tzdata curl ca-certificates gnupg \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && npm install -g @anthropic-ai/claude-code \
    # weasyprint's PDF rendering engine (tailored-CV PDFs) — pango/cairo/
    # gdk-pixbuf for layout+rasterization, fonts-liberation as an Arial/
    # Helvetica-equivalent since the base image ships no fonts at all
    && apt-get install -y --no-install-recommends \
        libpango-1.0-0 libpangocairo-1.0-0 libgdk-pixbuf-2.0-0 libffi8 \
        shared-mime-info fonts-liberation \
    && apt-get purge -y curl gnupg \
    && rm -rf /var/lib/apt/lists/*

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

RUN useradd --create-home --uid 1000 --shell /bin/sh appuser


RUN mkdir -p media/cvs logs /home/appuser/.claude \
    && chown -R appuser:appuser /app /home/appuser/.claude

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 8888

ENTRYPOINT ["docker-entrypoint.sh"]
