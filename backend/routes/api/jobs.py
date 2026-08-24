from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.databases.models import JobPosting
from backend.databases.session import get_db
from backend.schema.job import JobOut

router = APIRouter(tags=["jobs"])


@router.get("", response_model=list[JobOut])
async def list_jobs(db: Annotated[AsyncSession, Depends(get_db)]):
    result = await db.scalars(select(JobPosting).order_by(JobPosting.posted_at.desc()))
    return result.all()


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
