from dataclasses import asdict

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.databases.models import JobPosting
from backend.scrapers.base import RawJob


async def save_jobs(db: AsyncSession, jobs: list[RawJob]) -> list[JobPosting]:
    """Upsert scraped jobs by (source, external_id). Returns newly inserted jobs."""
    new_jobs: list[JobPosting] = []

    for job in jobs:
        existing = await db.scalar(
            select(JobPosting).where(
                JobPosting.source == job.source,
                JobPosting.external_id == job.external_id,
            )
        )

        if existing:
            for field, value in asdict(job).items():
                setattr(existing, field, value)
            continue

        duplicate = await db.scalar(
            select(JobPosting).where(
                func.lower(func.trim(JobPosting.company)) == job.company.strip().lower(),
                func.lower(func.trim(JobPosting.title)) == job.title.strip().lower(),
            )
        )

        if duplicate:
            continue  # same job already stored from another source

        job_posting = JobPosting(**asdict(job))
        db.add(job_posting)
        new_jobs.append(job_posting)

    await db.commit()
    return new_jobs
