import logging
import os
from contextlib import asynccontextmanager

import httpx
import uvicorn
from apify_client import ApifyClientAsync
from fastapi import FastAPI

from backend.databases.session import engine, init_models
from backend.routes.api import cv, jobs, scrape
from backend.scrapers import sources  # noqa: F401 — triggers @register on import
from core.logging import log_main
from core.settings import SETTINGS

logging.getLogger("uvicorn.access").setLevel(logging.ERROR)
os.makedirs(SETTINGS.CV_UPLOAD_DIR, exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.apify_client = ApifyClientAsync(SETTINGS.APIFY_API_TOKEN)
    app.state.http_client = httpx.AsyncClient()
    await init_models()
    yield
    await app.state.http_client.aclose()
    await engine.dispose()


app = FastAPI(title="Job Scrapper", lifespan=lifespan)
app.include_router(scrape.router, prefix="/api/scrape")
app.include_router(jobs.router, prefix="/api/jobs")
app.include_router(cv.router, prefix="/api/cv")


@app.get("/")
def health():
    return {"status": "ok", "llm_provider": SETTINGS.LLM_PROVIDER}


log_main("starting main server")
uvicorn.run(
    app,
    host="0.0.0.0",
    port=SETTINGS.UVICORN_PORT,
    log_level="info",
    workers=1,
    access_log=False,
)
