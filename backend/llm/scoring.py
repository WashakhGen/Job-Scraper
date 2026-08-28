import asyncio
from collections.abc import Sequence

from langchain_core.exceptions import ModelError
from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field

from backend.databases.models import JobPosting
from backend.llm.provider import get_llm, wait_for_rate_limit
from core.logging import log_main

# free-tier Gemini is capped at 15 requests/min — keep concurrency modest so a
_SCORE_CONCURRENCY = 3
_MAX_RETRIES = 3
_RETRY_BASE_DELAY = 3.0  # seconds


class MatchResultSchema(BaseModel):
    score: int = Field(description="0-100 match score, following the rubric exactly")
    location_match: bool = Field(
        description="true only if the job is genuinely reachable for the candidate — "
        "on-site/hybrid in one of their target locations, or remote without a region "
        "restriction that excludes them"
    )
    rationale: str = Field(
        description="one or two sentences explaining the score, citing specific matches and gaps"
    )
    matched: list[str] = Field(
        description="key requirements the CV clearly satisfies", default_factory=list
    )
    missing: list[str] = Field(
        description="key requirements the CV does not evidence", default_factory=list
    )


_RUBRIC = """\
You are a technical recruiter scoring how well a candidate's CV matches a job posting.
Score from 0 to 100 using this rubric:
- 90-100: Meets essentially all core requirements; strong direct experience with the
  main stack and responsibilities.
- 75-89: Meets most core requirements; minor gaps the candidate could quickly close.
- 60-74: Meets the fundamentals but misses several important requirements or has less
  depth than asked.
- 40-59: Partial match; some relevant skills but missing multiple core requirements or
  seniority.
- 20-39: Weak match; only tangential overlap.
- 0-19: Not a match.

Scoring rules:
- Judge ONLY on evidence in the CV. Do not assume skills that aren't shown.
- Weight the job's core/required skills far more heavily than nice-to-haves.
- Account for seniority: if the role wants more years or a higher level than the CV
  shows, cap the score in the 60-74 band or below, even if skills overlap.
- Be consistent and calibrated — the same CV/job should always get the same score.
- List the specific requirements the CV satisfies (matched) and those it doesn't
  (missing).

Location rules:
- location_match is true only if the job is on-site/hybrid in one of the candidate's
  target locations/country, or genuinely remote-eligible for someone based there.
- Read the location text carefully — "Remote" alone is not enough if it's qualified
  with a region/country restriction that excludes the candidate (e.g. "Remote (US
  only)", "Remote — Americas, Europe, Israel"). Those are location_match: false.
- If location_match is false, the overall score MUST be 19 or below regardless of how
  well the skills match — a job the candidate cannot actually take is not a match."""


async def score_match(
    cv_text: str,
    job_title: str,
    job_description: str,
    job_location: str,
    target_locations: list[str],
) -> MatchResultSchema:
    llm = get_llm().with_structured_output(MatchResultSchema)
    await wait_for_rate_limit()
    location_context = (
        f"Candidate's target locations: {', '.join(target_locations)}"
        if target_locations
        else "Candidate has not specified target locations — do not penalize location, "
        "set location_match to true."
    )
    result = await llm.ainvoke(
        [
            SystemMessage(content=_RUBRIC),
            HumanMessage(
                content=(
                    f"{location_context}\n\n"
                    f"CV:\n{cv_text}\n\n"
                    f"Job title: {job_title}\n"
                    f"Job location: {job_location}\n\n"
                    f"Job description:\n{job_description}"
                )
            ),
        ]
    )
    assert isinstance(result, MatchResultSchema)

    # don't just trust the LLM followed the cap instruction — enforce it in code too
    if target_locations and not result.location_match:
        result.score = min(result.score, 19)

    return result


async def _score_job(
    semaphore: asyncio.Semaphore,
    cv_text: str,
    job: JobPosting,
    target_locations: list[str],
) -> tuple[JobPosting, MatchResultSchema | None]:
    """
    Score one job while respecting the concurrency limit.

    Returns the job together with its match result.
    If scoring still fails after retries, the result is None.
    """

    async with semaphore:
        last_exc: Exception | None = None

        for attempt in range(_MAX_RETRIES + 1):
            try:
                result = await score_match(
                    cv_text=cv_text,
                    job_title=job.title,
                    job_description=job.description or "",
                    job_location=job.location or "",
                    target_locations=target_locations,
                )

                return job, result

            except Exception as exc:
                last_exc = exc
                retryable = isinstance(exc, ModelError) and exc.is_retryable

                if retryable and attempt < _MAX_RETRIES:
                    delay = _RETRY_BASE_DELAY * (2**attempt)
                    log_main(
                        f"job {job.id} ({job.title}): {type(exc).__name__}, "
                        f"retrying in {delay:.0f}s ({attempt + 1}/{_MAX_RETRIES})"
                    )
                    await asyncio.sleep(delay)
                    continue

                break

        log_main(f"Error scoring job {job.id} ({job.title}): {type(last_exc).__name__}: {last_exc}")

        return job, None


async def score_jobs(
    cv_text: str,
    jobs: Sequence[JobPosting],
    target_locations: list[str],
) -> list[tuple[JobPosting, MatchResultSchema]]:
    """
    Score multiple jobs concurrently with a bounded concurrency limit.
    """

    if not jobs:
        return []

    semaphore = asyncio.Semaphore(_SCORE_CONCURRENCY)

    results = await asyncio.gather(
        *[
            _score_job(
                semaphore=semaphore,
                cv_text=cv_text,
                job=job,
                target_locations=target_locations,
            )
            for job in jobs
        ]
    )

    successful_results: list[tuple[JobPosting, MatchResultSchema]] = []

    for job, result in results:
        if result is not None:
            successful_results.append((job, result))

    return successful_results
