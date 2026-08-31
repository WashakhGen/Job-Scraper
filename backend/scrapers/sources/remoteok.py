import httpx

from backend.scrapers.base import RawJob, ScraperAdapter
from backend.scrapers.registry import register

BASE_URL = "https://remoteok.com/api"


@register("remoteok")
class RemoteOKScraper(ScraperAdapter):
    name = "remoteok"
    client_kind = "http"

    def __init__(self, client: httpx.AsyncClient | None = None):
        self.client = client or httpx.AsyncClient()

    async def fetch(
        self, keywords: list[str], location: str | None = None, limit: int = 25
    ) -> list[RawJob]:
        resp = await self.client.get(BASE_URL, headers={"User-Agent": "Job-Scraper/1.0"})
        resp.raise_for_status()
        items = resp.json()[1:]  # first item is API metadata, not a job

        needles = [k.lower() for k in keywords]
        jobs = []
        for item in items:
            title = item.get("position", "")
            if needles and not any(n in title.lower() for n in needles):
                continue
            jobs.append(
                RawJob(
                    source=self.name,
                    external_id=str(item.get("id", "")),
                    title=title,
                    company=item.get("company", ""),
                    location=item.get("location") or "Remote",
                    url=item.get("url", ""),
                    description=item.get("description", ""),
                    posted_at=item.get("date"),
                )
            )
            if len(jobs) >= limit:
                break
        return jobs
