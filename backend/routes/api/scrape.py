from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.databases.models import CV
from backend.databases.session import get_db
from backend.routes.background.scraper_service import (
    run_scrape_all_and_finish,
    run_scrape_and_finish,
)
from backend.schema.scrape import ScrapeRequest, ScrapeResponse, ScrapeStatus
from backend.scrapers.registry import SCRAPERS

router = APIRouter(tags=["scrape"])


@router.get("/sources")
async def list_sources() -> list[str]:
    return sorted(SCRAPERS.keys())


@router.get("/status", response_model=ScrapeStatus)
async def get_scrape_status(request: Request):
    return ScrapeStatus(running=request.app.state.scrape_state.running)


@router.post("/all", response_model=ScrapeResponse)
async def trigger_scrape_all(
    body: ScrapeRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    active_cv = await db.scalar(select(CV).where(CV.is_active.is_(True)))
    if active_cv is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No active CV")

    if not request.app.state.scrape_state.try_start():
        raise HTTPException(status.HTTP_409_CONFLICT, "A scrape is already running")

    background_tasks.add_task(
        run_scrape_all_and_finish, request.app.state, active_cv.id, body.location, body.limit
    )
    return ScrapeResponse(status="accepted", source="all")


@router.post("/{source}", response_model=ScrapeResponse)
async def trigger_scrape(
    source: str,
    body: ScrapeRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    # 1. Validate source
    adapter_cls = SCRAPERS.get(source)
    if adapter_cls is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Unknown source: {source}",
        )

    # 2. Find active CV

    active_cv = await db.scalar(select(CV).where(CV.is_active.is_(True)))
    if active_cv is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active CV",
        )

    # 3. Reserve the shared scrape slot

    if not request.app.state.scrape_state.try_start():
        raise HTTPException(status.HTTP_409_CONFLICT, "A scrape is already running")

    # 4. Queue background job

    background_tasks.add_task(
        run_scrape_and_finish,
        request.app.state,
        source,
        active_cv.id,
        body.location,
        body.limit,
    )

    return ScrapeResponse(status="accepted", source=source)
