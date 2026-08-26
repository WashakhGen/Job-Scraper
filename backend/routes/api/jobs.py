from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.databases.models import CV, JobPosting, MatchResult
from backend.databases.session import get_db
from backend.databases.utils import get_app_settings
from backend.schema.job import AppSettingsOut, JobOut
from backend.schema.match import AppliedUpdate, JobRecommendation

router = APIRouter(tags=["jobs"])


def _to_recommendation(job: JobPosting, match: MatchResult) -> JobRecommendation:
    return JobRecommendation(
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
        applied=match.applied,
    )


async def _resolve_cv_id(db: AsyncSession, cv_id: int | None) -> int:
    if cv_id is not None:
        return cv_id
    active_cv = await db.scalar(select(CV).where(CV.is_active.is_(True)))
    if active_cv is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No active CV and no cv_id given")
    return active_cv.id


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
    cv_id = await _resolve_cv_id(db, cv_id)

    result = await db.execute(
        select(JobPosting, MatchResult)
        .join(MatchResult, MatchResult.job_id == JobPosting.id)
        .where(
            MatchResult.cv_id == cv_id,
            MatchResult.score >= app_settings.min_score,
            MatchResult.applied.is_(False),
        )
        .order_by(MatchResult.score.desc(), JobPosting.posted_at.desc())
    )
    return [_to_recommendation(job, match) for job, match in result.all()]


@router.get("/applied", response_model=list[JobRecommendation])
async def list_applied_jobs(
    db: Annotated[AsyncSession, Depends(get_db)],
    cv_id: int | None = None,
):
    cv_id = await _resolve_cv_id(db, cv_id)
    result = await db.execute(
        select(JobPosting, MatchResult)
        .join(MatchResult, MatchResult.job_id == JobPosting.id)
        .where(MatchResult.cv_id == cv_id, MatchResult.applied.is_(True))
        .order_by(MatchResult.applied_at.desc())
    )
    return [_to_recommendation(job, match) for job, match in result.all()]


@router.put("/{job_id}/applied", response_model=JobRecommendation)
async def mark_applied(
    job_id: int,
    body: AppliedUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    cv_id: int | None = None,
):
    cv_id = await _resolve_cv_id(db, cv_id)
    match = await db.scalar(
        select(MatchResult).where(MatchResult.job_id == job_id, MatchResult.cv_id == cv_id)
    )
    if match is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No match result for this job/CV")

    match.applied = body.applied
    match.applied_at = datetime.now(UTC) if body.applied else None
    await db.commit()
    await db.refresh(match)

    job = await db.get(JobPosting, job_id)
    if job is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Job no longer exists")
    return _to_recommendation(job, match)


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
