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
    applied: bool


class AppliedUpdate(BaseModel):
    applied: bool


class JobDetail(BaseModel):
    job_id: int
    title: str
    company: str
    location: str
    url: str
    source: str
    description: str
    posted_at: str | None
    scraped_at: datetime
    # match fields are optional — a job can exist without a score yet
    # (scoring failed, or it just hasn't run) and the detail page still needs to render it
    score: float | None = None
    rationale: str | None = None
    matched: list[str] = []
    missing: list[str] = []
    cover_letter: str | None = None
    applied: bool = False
    scored_at: datetime | None = None
