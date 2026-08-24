import logging
from contextlib import asynccontextmanager

import uvicorn
from apify_client import ApifyClientAsync
from fastapi import FastAPI

from backend.core.logging import log_main
from backend.core.settings import SETTINGS
from backend.routes.api import scrape
from backend.scrapers import sources  # noqa: F401 — triggers @register on import

logging.getLogger("uvicorn.access").setLevel(logging.ERROR)


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.apify_client = ApifyClientAsync(SETTINGS.APIFY_API_TOKEN)
    yield


app = FastAPI(title="Job Scrapper", lifespan=lifespan)
app.include_router(scrape.router, prefix="/api/scrape")


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
