from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


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


class ManualJobCreate(BaseModel):
    """A job pasted in from outside the scraped sources — LinkedIn, a
    company site, an email, wherever. Scored and given a cover letter
    immediately, same as any other job from there on."""

    title: str = Field(min_length=1)
    company: str = Field(min_length=1)
    description: str = Field(min_length=1)
    location: str = ""
    url: str = ""
