from fastapi import APIRouter, BackgroundTasks, HTTPException, Request

from backend.core.logging import log_main
from backend.schema.scrape import ScrapeRequest, ScrapeResponse
from backend.scrapers.registry import SCRAPERS

router = APIRouter(tags=["scrape"])


async def _run_scrape(
    app_state, source: str, keywords: list[str], location: str | None, limit: int
):
    adapter = SCRAPERS[source](client=app_state.apify_client)  # pyright: ignore[reportCallIssue]
    jobs = await adapter.fetch(keywords, location, limit)
    log_main(f"{source}: fetched {len(jobs)} jobs")


@router.post("/{source}", response_model=ScrapeResponse)
async def trigger_scrape(
    source: str,
    body: ScrapeRequest,
    request: Request,
    background_tasks: BackgroundTasks,
):
    if source not in SCRAPERS:
        raise HTTPException(404, f"Unknown source: {source}")
    background_tasks.add_task(
        _run_scrape, request.app.state, source, body.keywords, body.location, body.limit
    )
    return ScrapeResponse(status="accepted", source=source)
