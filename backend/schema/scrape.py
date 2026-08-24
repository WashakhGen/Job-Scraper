from pydantic import BaseModel


class ScrapeRequest(BaseModel):
    keywords: list[str]
    location: str | None = None
    limit: int = 25


class ScrapeResponse(BaseModel):
    status: str
    source: str
