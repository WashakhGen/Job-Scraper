import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.databases.models import CV, JobPosting, MatchResult
from backend.databases.session import get_db
from backend.databases.utils import get_app_settings, get_candidate_profile
from backend.llm.cover_letter import generate_cover_letter
from backend.llm.scoring import score_match
from backend.routes.api.cv import _get_or_create_markdown
from backend.schema.job import AppSettingsOut, JobOut, ManualJobCreate
from backend.schema.match import AppliedUpdate, JobDetail, JobRecommendation
from core.pdf import build_pdf, cover_letter_to_html

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


def _to_detail(job: JobPosting, match: MatchResult | None) -> JobDetail:
    return JobDetail(
        job_id=job.id,
        title=job.title,
        company=job.company,
        location=job.location,
        url=job.url,
        source=job.source,
        description=job.description,
        posted_at=job.posted_at,
        scraped_at=job.scraped_at,
        score=match.score if match else None,
        rationale=match.rationale if match else None,
        matched=match.matched if match else [],
        missing=match.missing if match else [],
        cover_letter=match.cover_letter if match else None,
        applied=match.applied if match else False,
        scored_at=match.created_at if match else None,
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


@router.get("/manual", response_model=list[JobRecommendation])
async def list_manual_jobs(
    db: Annotated[AsyncSession, Depends(get_db)],
    cv_id: int | None = None,
):
    """Jobs added via 'Bring Your own Job' — every one of them, regardless
    of score, since they were never gated behind min_score to begin with.

    Match-joined (unlike GET /{source}, which returns bare JobOut with no
    score) so the score and cover letter that were generated at creation
    time are actually visible here instead of looking unscored.
    """
    cv_id = await _resolve_cv_id(db, cv_id)
    result = await db.execute(
        select(JobPosting, MatchResult)
        .join(MatchResult, MatchResult.job_id == JobPosting.id)
        .where(JobPosting.source == "manual", MatchResult.cv_id == cv_id)
        .order_by(JobPosting.scraped_at.desc())
    )
    return [_to_recommendation(job, match) for job, match in result.all()]


@router.put("/{job_id}/applied", response_model=JobRecommendation)
async def mark_applied(
    job_id: int,
    body: AppliedUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    cv_id: int | None = None,
):
    job = await db.get(JobPosting, job_id)
    if job is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Job not found")

    cv_id = await _resolve_cv_id(db, cv_id)
    match = await db.scalar(
        select(MatchResult).where(MatchResult.job_id == job_id, MatchResult.cv_id == cv_id)
    )
    if match is None:
        # unscored job (never went through the LLM pipeline, or scoring failed) —
        # applying manually shouldn't be blocked on that, create a placeholder match
        match = MatchResult(
            cv_id=cv_id,
            job_id=job_id,
            score=0,
            rationale="Marked applied manually — not scored by the pipeline.",
            matched=[],
            missing=[],
        )
        db.add(match)

    match.applied = body.applied
    match.applied_at = datetime.now(UTC) if body.applied else None
    await db.commit()
    await db.refresh(match)
    return _to_recommendation(job, match)


@router.post("/manual", response_model=JobDetail)
async def create_manual_job(
    body: ManualJobCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    cv_id: int | None = None,
):
    """For a job found outside the scraped sources"""
    cv_id = await _resolve_cv_id(db, cv_id)
    cv = await db.get(CV, cv_id)
    if cv is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "CV not found")

    cv_text = _get_or_create_markdown(Path(cv.file_path))
    app_settings = await get_app_settings(db)

    job = JobPosting(
        source="manual",
        external_id=str(uuid.uuid4()),
        title=body.title.strip(),
        company=body.company.strip(),
        location=body.location.strip(),
        url=body.url.strip(),
        description=body.description.strip(),
        posted_at=None,
    )
    db.add(job)
    await db.flush()  # need job.id before the match row can reference it

    result = await score_match(
        cv_text=cv_text,
        job_title=job.title,
        job_description=job.description,
        job_location=job.location,
        target_locations=app_settings.locations,
    )

    match = MatchResult(
        cv_id=cv_id,
        job_id=job.id,
        score=result.score,
        rationale=result.rationale,
        matched=result.matched,
        missing=result.missing,
    )

    # explicit ad-hoc request, not the auto-recommend flow — generate the
    # letter regardless of min_score, the user is already looking at this job
    match.cover_letter = await generate_cover_letter(
        cv_text=cv_text,
        job_title=job.title,
        company=job.company,
        matched=match.matched,
        missing=match.missing,
    )
    db.add(match)

    await db.commit()
    await db.refresh(job)
    await db.refresh(match)

    return _to_detail(job, match)


@router.get("/detail/{job_id}", response_model=JobDetail)
async def get_job_detail(
    job_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    cv_id: int | None = None,
):
    job = await db.get(JobPosting, job_id)
    if job is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Job not found")

    cv_id = await _resolve_cv_id(db, cv_id)
    match = await db.scalar(
        select(MatchResult).where(MatchResult.job_id == job_id, MatchResult.cv_id == cv_id)
    )
    return _to_detail(job, match)


@router.post("/{job_id}/cover-letter", response_model=JobDetail)
async def generate_job_cover_letter(
    job_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    cv_id: int | None = None,
):
    """Generate (or regenerate) a cover letter for any job, scored or not.

    If the job was never scored — e.g. it's outside the recommended threshold,
    or scoring failed — score it first so the cover letter is grounded in real
    matched/missing requirements instead of guessing from the raw description.
    """
    job = await db.get(JobPosting, job_id)
    if job is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Job not found")

    cv_id = await _resolve_cv_id(db, cv_id)
    cv = await db.get(CV, cv_id)
    if cv is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "CV not found")

    cv_text = _get_or_create_markdown(Path(cv.file_path))

    match = await db.scalar(
        select(MatchResult).where(MatchResult.job_id == job_id, MatchResult.cv_id == cv_id)
    )
    if match is None:
        app_settings = await get_app_settings(db)
        result = await score_match(
            cv_text=cv_text,
            job_title=job.title,
            job_description=job.description or "",
            job_location=job.location or "",
            target_locations=app_settings.locations,
        )
        match = MatchResult(
            cv_id=cv_id,
            job_id=job_id,
            score=result.score,
            rationale=result.rationale,
            matched=result.matched,
            missing=result.missing,
        )
        db.add(match)

    match.cover_letter = await generate_cover_letter(
        cv_text=cv_text,
        job_title=job.title,
        company=job.company,
        matched=match.matched,
        missing=match.missing,
    )
    await db.commit()
    await db.refresh(match)
    return _to_detail(job, match)


@router.get("/{job_id}/cover-letter.pdf")
async def download_cover_letter_pdf(
    job_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    cv_id: int | None = None,
):
    job = await db.get(JobPosting, job_id)
    if job is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Job not found")

    cv_id = await _resolve_cv_id(db, cv_id)
    match = await db.scalar(
        select(MatchResult).where(MatchResult.job_id == job_id, MatchResult.cv_id == cv_id)
    )
    if match is None or not match.cover_letter:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No cover letter generated yet for this job")

    profile = await get_candidate_profile(db)
    pdf_bytes = build_pdf(
        cover_letter_to_html(match.cover_letter),
        name=profile.name,
        headline=profile.headline,
        location=profile.location,
        phone=profile.phone,
        email=profile.email,
        links=profile.links,
    )
    filename = f"Cover Letter - {job.company}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/settings", response_model=AppSettingsOut)
async def get_settings(db: Annotated[AsyncSession, Depends(get_db)]):
    return await get_app_settings(db)


@router.put("/settings", response_model=AppSettingsOut)
async def update_settings(body: AppSettingsOut, db: Annotated[AsyncSession, Depends(get_db)]):
    settings_row = await get_app_settings(db)
    settings_row.min_score = body.min_score
    settings_row.locations = body.locations
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
