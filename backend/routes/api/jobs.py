from typing import Annotated

from fastapi import APIRouter, Depends
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
