from typing import Annotated

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from backend.databases.models import ScheduleConfig
from backend.databases.session import get_db
from backend.databases.utils import get_schedule_config
from backend.routes.background.scheduler_service import JOB_ID, configure_job
from backend.schema.schedule import ScheduleConfigOut, ScheduleConfigUpdate

router = APIRouter(tags=["schedule"])


def _next_run_at(request: Request):
    job = request.app.state.scheduler.get_job(JOB_ID)
    return job.next_run_time if job else None


def _to_out(config: ScheduleConfig, next_run_at) -> ScheduleConfigOut:
    return ScheduleConfigOut(
        enabled=config.enabled,
        frequency=config.frequency,  # pyright: ignore[reportArgumentType]
        hour=config.hour,
        minute=config.minute,
        day_of_week=config.day_of_week,
        day_of_month=config.day_of_month,
        limit=config.limit,
        last_run_at=config.last_run_at,
        next_run_at=next_run_at,
    )


@router.get("", response_model=ScheduleConfigOut)
async def get_schedule(request: Request, db: Annotated[AsyncSession, Depends(get_db)]):
    config = await get_schedule_config(db)
    return _to_out(config, _next_run_at(request))


@router.put("", response_model=ScheduleConfigOut)
async def update_schedule(
    body: ScheduleConfigUpdate,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    config = await get_schedule_config(db)
    config.enabled = body.enabled
    config.frequency = body.frequency
    config.hour = body.hour
    config.minute = body.minute
    config.day_of_week = body.day_of_week
    config.day_of_month = body.day_of_month
    config.limit = body.limit
    await db.commit()
    await db.refresh(config)

    configure_job(request.app.state.scheduler, request.app.state, config)

    return _to_out(config, _next_run_at(request))
