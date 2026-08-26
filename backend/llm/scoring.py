import asyncio
from collections.abc import Sequence

from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field

from backend.databases.models import JobPosting
from backend.llm.provider import get_llm
from core.logging import log_main

_SCORE_CONCURRENCY = 5


class MatchResultSchema(BaseModel):
    score: int = Field(description="0-100 match score, following the rubric exactly")
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
  (missing)."""


async def score_match(cv_text: str, job_title: str, job_description: str) -> MatchResultSchema:

    llm = get_llm().with_structured_output(MatchResultSchema)
    result = await llm.ainvoke(
        [
            SystemMessage(content=_RUBRIC),
            HumanMessage(
                content=(
                    f"CV:\n{cv_text}\n\n"
                    f"Job title: {job_title}\n\n"
                    f"Job description:\n{job_description}"
                )
            ),
        ]
    )
    assert isinstance(result, MatchResultSchema)
    return result


async def _score_job(
    semaphore: asyncio.Semaphore,
    cv_text: str,
    job: JobPosting,
) -> tuple[JobPosting, MatchResultSchema | None]:
    """
    Score one job while respecting the concurrency limit.

    Returns the job together with its match result.
    If scoring fails, the result is None.
    """

    async with semaphore:
        try:
            result = await score_match(
                cv_text=cv_text,
                job_title=job.title,
                job_description=job.description or "",
            )

            return job, result

        except Exception as exc:
            log_main(f"Error scoring job {job.id} ({job.title}): {exc}")

            return job, None


async def score_jobs(
    cv_text: str,
    jobs: Sequence[JobPosting],
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
            )
            for job in jobs
        ]
    )

    successful_results: list[tuple[JobPosting, MatchResultSchema]] = []

    for job, result in results:
        if result is not None:
            successful_results.append((job, result))

    return successful_results
