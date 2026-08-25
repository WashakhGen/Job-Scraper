import html
import re
from abc import ABC, abstractmethod
from dataclasses import dataclass

from core.settings import SETTINGS


def _clean_description(text: str, max_chars: int = 4000) -> str:
    text = re.sub(r"<[^>]+>", " ", text)  # strip HTML tags
    text = html.unescape(text)  # decode &ndash; &quot; etc.
    text = re.sub(r"\s+", " ", text).strip()  # collapse whitespace/newlines
    return text[:max_chars]


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

    def __post_init__(self):
        self.description = _clean_description(self.description)


class ScraperAdapter(ABC):
    name: str
    client_kind: str = "http"

    @abstractmethod
    async def fetch(
        self,
        keywords: list[str],
        location: str | None = None,
        limit: int = SETTINGS.APIFY_RESULT_LIMIT,
    ) -> list[RawJob]: ...
