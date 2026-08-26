from datetime import datetime

from pydantic import BaseModel


class JobRecommendation(BaseModel):
    job_id: int
    title: str
    company: str
    location: str
    url: str
    source: str
    posted_at: str | None
    score: float
    rationale: str
    matched: list[str]
    missing: list[str]
    cover_letter: str | None
    scored_at: datetime
