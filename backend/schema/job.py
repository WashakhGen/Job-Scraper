from datetime import datetime

from pydantic import BaseModel, ConfigDict


class JobOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    source: str
    external_id: str
    title: str
    company: str
    location: str
    url: str
    description: str
    posted_at: str | None
    scraped_at: datetime


class AppSettingsOut(BaseModel):
    min_score: int
    locations: list[str]
