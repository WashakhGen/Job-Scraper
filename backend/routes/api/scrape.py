from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.databases.models import CV
from backend.databases.session import get_db
from backend.routes.background.scraper_service import _run_scrape, _run_scrape_all
from backend.schema.scrape import ScrapeRequest, ScrapeResponse
from backend.scrapers.registry import SCRAPERS
from core.settings import SETTINGS

router = APIRouter(tags=["scrape"])


@router.post("/all", response_model=ScrapeResponse)
async def trigger_scrape_all(
    request: Request,
    background_tasks: BackgroundTasks,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    active_cv = await db.scalar(select(CV).where(CV.is_active.is_(True)))
    if active_cv is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No active CV")
    background_tasks.add_task(
        _run_scrape_all, request.app.state, active_cv.id, None, SETTINGS.APIFY_RESULT_LIMIT
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

    # 3. Queue background job

    background_tasks.add_task(
        _run_scrape,
        request.app.state,
        source,
        active_cv.id,
        body.location,
        body.limit,
    )

    return ScrapeResponse(status="accepted", source=source)
