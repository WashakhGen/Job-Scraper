from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class RawJob:
    source: str
    external_id: str
    title: str
    company: str
    location: str
    url: str
    description: str
    posted_at: str | None


class ScraperAdapter(ABC):
    name: str

    @abstractmethod
    async def fetch(
        self, keywords: list[str], location: str | None = None, limit: int = 25
    ) -> list[RawJob]: ...
