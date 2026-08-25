from pydantic import BaseModel

from core.settings import SETTINGS


class ScrapeRequest(BaseModel):
    keywords: list[str]
    location: str | None = None
    limit: int = SETTINGS.APIFY_RESULT_LIMIT


class ScrapeResponse(BaseModel):
    status: str
    source: str
