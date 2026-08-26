from pathlib import Path

from backend.databases.models import CV, MatchResult
from backend.databases.session import AsyncSessionLocal
from backend.databases.utils import get_app_settings, save_jobs
from backend.llm.cover_letter import generate_cover_letter
from backend.llm.scoring import score_jobs
from backend.routes.api.cv import _get_or_create_markdown
from backend.scrapers.registry import SCRAPERS
from core.logging import log_main


async def _run_scrape_all(app_state, cv_id: int, location: str | None, limit: int) -> None:
    for source in SCRAPERS:
        await _run_scrape(app_state, source, cv_id, location, limit)


async def _run_scrape(
    app_state,
    source: str,
    cv_id: int,
    location: str | None,
    limit: int,
) -> None:
    """
    Background scrape + job matching process.
    """

    try:
        await _run_scrape_internal(
            app_state=app_state,
            source=source,
            cv_id=cv_id,
            location=location,
            limit=limit,
        )
    except Exception as exc:
        log_main(f"Scrape failed for source={source}, cv_id={cv_id}: {exc}")


async def _run_scrape_internal(
    app_state,
    source: str,
    cv_id: int,
    location: str | None,
    limit: int,
) -> None:

    # 1. Load CV using a fresh DB session
    log_main("Loading CV From DB")
    async with AsyncSessionLocal() as session:
        active_cv = await session.get(
            CV,
            cv_id,
        )

    if active_cv is None:
        log_main(f"CV {cv_id} no longer exists")
        return

    if not active_cv.is_active:
        log_main(f"CV {cv_id} is no longer active")
        return

    keywords = active_cv.keywords

    if not keywords:
        log_main(f"CV {cv_id} has no keywords")
        return

    # 2. Get CV text
    log_main("Getting Data from CV")
    cv_text = _get_or_create_markdown(Path(active_cv.file_path))

    # 3. Create scraper adapter

    adapter_cls = SCRAPERS[source]
    log_main(f"Scrapping Jobs from {adapter_cls}")
    client = app_state.apify_client if adapter_cls.client_kind == "apify" else app_state.http_client
    adapter = adapter_cls(client=client)  # pyright: ignore[reportCallIssue]  # ty: ignore[unknown-argument]

    # 4. Fetch jobs
    jobs = await adapter.fetch(
        keywords,
        location,
        limit,
    )
    log_main(f"{source}: fetched {len(jobs)} jobs")

    if not jobs:
        return

    # 5. Save jobs
    log_main("Saving New Jobs in  Database ")
    async with AsyncSessionLocal() as session:
        new_jobs = await save_jobs(session, jobs)
        log_main(f"{source}: {len(new_jobs)} new jobs inserted")

    if not new_jobs:
        log_main(f"{source}: no new jobs to score")
        return

    # 6. Score jobs concurrently
    log_main("Scoring New Jobs")
    match_results = await score_jobs(
        cv_text=cv_text,
        jobs=new_jobs,
    )

    log_main(f"{source}: {len(match_results)}/{len(new_jobs)} jobs scored")

    if not match_results:
        return

    # 7. Save match results
    log_main("Saving Matched Jobs")
    async with AsyncSessionLocal() as session:
        app_settings = await get_app_settings(session)

        for job, match_data in match_results:
            cover_letter = None
            if match_data.score >= app_settings.min_score:
                try:
                    cover_letter = await generate_cover_letter(
                        cv_text=cv_text,
                        job_title=job.title,
                        company=job.company,
                        matched=match_data.matched,
                        missing=match_data.missing,
                    )
                except Exception as exc:
                    log_main(f"Cover letter failed for job {job.id}: {type(exc).__name__}: {exc}")

            match_entry = MatchResult(
                cv_id=cv_id,
                job_id=job.id,
                score=match_data.score,
                rationale=match_data.rationale,
                matched=match_data.matched,
                missing=match_data.missing,
                cover_letter=cover_letter,
            )

            session.add(match_entry)

        await session.commit()

    log_main(f"{source}: saved {len(match_results)} match results")
