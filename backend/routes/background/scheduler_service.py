from datetime import UTC, datetime

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import select

from backend.databases.models import CV, ScheduleConfig
from backend.databases.session import AsyncSessionLocal
from backend.databases.utils import get_app_settings, get_schedule_config
from backend.routes.background.scraper_service import _run_scrape
from backend.scrapers.registry import SCRAPERS
from core.logging import log_main

JOB_ID = "scheduled_scrape"


def build_trigger(config: ScheduleConfig) -> CronTrigger:
    if config.frequency == "daily":
        return CronTrigger(hour=config.hour, minute=config.minute)
    if config.frequency == "weekly":
        return CronTrigger(
            day_of_week=config.day_of_week if config.day_of_week is not None else 0,
            hour=config.hour,
            minute=config.minute,
        )
    return CronTrigger(
        day=config.day_of_month if config.day_of_month is not None else 1,
        hour=config.hour,
        minute=config.minute,
    )


async def run_scheduled_scrape(app_state) -> None:
    """The job body APScheduler fires. Scrapes every registered source for
    the active CV, using the saved location filter — same shape as a manual
    'scrape all sources' run."""

    log_main("Scheduled scrape starting")

    if not app_state.scrape_state.try_start():
        log_main("Scheduled scrape skipped: a scrape is already running")
        return

    try:
        async with AsyncSessionLocal() as session:
            active_cv = await session.scalar(select(CV).where(CV.is_active.is_(True)))
            app_settings = await get_app_settings(session)
            config = await get_schedule_config(session)

        if active_cv is None:
            log_main("Scheduled scrape skipped: no active CV")
            return

        locations: list[str | None] = (
            list(app_settings.locations) if app_settings.locations else [None]
        )

        for source in SCRAPERS:
            for location in locations:
                await _run_scrape(app_state, source, active_cv.id, location, config.limit)

        async with AsyncSessionLocal() as session:
            config = await get_schedule_config(session)
            config.last_run_at = datetime.now(UTC)
            await session.commit()

        log_main("Scheduled scrape finished")
    finally:
        app_state.scrape_state.finish()


def configure_job(scheduler: AsyncIOScheduler, app_state, config: ScheduleConfig) -> None:
    """(Re)apply a ScheduleConfig row to the running scheduler. Safe to call
    repeatedly — always removes any existing job first."""

    if scheduler.get_job(JOB_ID) is not None:
        scheduler.remove_job(JOB_ID)

    if config.enabled:
        scheduler.add_job(
            run_scheduled_scrape,
            trigger=build_trigger(config),
            args=[app_state],
            id=JOB_ID,
            replace_existing=True,
            misfire_grace_time=3600,
        )
