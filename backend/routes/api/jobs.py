from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.databases.models import CV, JobPosting, MatchResult
from backend.databases.session import get_db
from backend.databases.utils import get_app_settings
from backend.schema.job import AppSettingsOut, JobOut
from backend.schema.match import JobRecommendation

router = APIRouter(tags=["jobs"])


@router.get("", response_model=list[JobOut])
async def list_jobs(db: Annotated[AsyncSession, Depends(get_db)]):
    result = await db.scalars(select(JobPosting).order_by(JobPosting.posted_at.desc()))
    return result.all()


@router.get("/recommended", response_model=list[JobRecommendation])
async def list_recommended_jobs(
    db: Annotated[AsyncSession, Depends(get_db)],
    cv_id: int | None = None,
):
    app_settings = await get_app_settings(db)

    if cv_id is None:
        active_cv = await db.scalar(select(CV).where(CV.is_active.is_(True)))
        if active_cv is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "No active CV and no cv_id given")
        cv_id = active_cv.id

    result = await db.execute(
        select(JobPosting, MatchResult)
        .join(MatchResult, MatchResult.job_id == JobPosting.id)
        .where(MatchResult.cv_id == cv_id, MatchResult.score >= app_settings.min_score)
        .order_by(MatchResult.score.desc(), JobPosting.posted_at.desc())
    )

    return [
        JobRecommendation(
            job_id=job.id,
            title=job.title,
            company=job.company,
            location=job.location,
            url=job.url,
            source=job.source,
            posted_at=job.posted_at,
            score=match.score,
            rationale=match.rationale,
            matched=match.matched,
            missing=match.missing,
            cover_letter=match.cover_letter,
            scored_at=match.created_at,
        )
        for job, match in result.all()
    ]


@router.get("/settings", response_model=AppSettingsOut)
async def get_settings(db: Annotated[AsyncSession, Depends(get_db)]):
    return await get_app_settings(db)


@router.put("/settings", response_model=AppSettingsOut)
async def update_settings(body: AppSettingsOut, db: Annotated[AsyncSession, Depends(get_db)]):
    settings_row = await get_app_settings(db)
    settings_row.min_score = body.min_score
    await db.commit()
    await db.refresh(settings_row)
    return settings_row


@router.get("/{source}", response_model=list[JobOut])
async def list_jobs_by_source(source: str, db: Annotated[AsyncSession, Depends(get_db)]):

    # Check Source exists
    result = await db.execute(select(JobPosting).where(JobPosting.source == source))
    if result.scalars().first():
        result = await db.scalars(
            select(JobPosting)
            .where(JobPosting.source == source)
            .order_by(JobPosting.posted_at.desc())
        )
        return result.all()

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source not found")
