import logging
import os
from contextlib import asynccontextmanager

import httpx
import uvicorn
from apify_client import ApifyClientAsync
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI

from backend.databases.session import AsyncSessionLocal, engine, init_models
from backend.databases.utils import get_schedule_config
from backend.routes.api import cv, jobs, schedule, scrape
from backend.routes.background.scheduler_service import configure_job
from backend.routes.background.scrape_state import ScrapeState
from backend.scrapers import sources  # noqa: F401 — triggers @register on import
from core.logging import log_main
from core.settings import SETTINGS

logging.getLogger("uvicorn.access").setLevel(logging.ERROR)
os.makedirs(SETTINGS.CV_UPLOAD_DIR, exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.apify_client = ApifyClientAsync(SETTINGS.APIFY_API_TOKEN)
    app.state.http_client = httpx.AsyncClient()
    app.state.scrape_state = ScrapeState()
    await init_models()

    scheduler = AsyncIOScheduler()
    scheduler.start()
    app.state.scheduler = scheduler
    async with AsyncSessionLocal() as session:
        schedule_config = await get_schedule_config(session)
    configure_job(scheduler, app.state, schedule_config)

    yield
    scheduler.shutdown()
    await app.state.http_client.aclose()
    await engine.dispose()


app = FastAPI(title="Job Scrapper", lifespan=lifespan)
app.include_router(scrape.router, prefix="/api/scrape")
app.include_router(jobs.router, prefix="/api/jobs")
app.include_router(cv.router, prefix="/api/cv")
app.include_router(schedule.router, prefix="/api/schedule")

app.frontend("/", directory="frontend/dist", fallback="index.html")


@app.get("/health")
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
