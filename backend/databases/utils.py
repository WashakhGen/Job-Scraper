from dataclasses import asdict

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.databases.models import JobPosting
from backend.scrapers.base import RawJob


async def save_jobs(db: AsyncSession, jobs: list[RawJob]) -> int:
    """Upsert scraped jobs by (source, external_id). Returns count of newly inserted rows."""
    inserted = 0
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
        else:
            db.add(JobPosting(**asdict(job)))
            inserted += 1

    await db.commit()
    return inserted
