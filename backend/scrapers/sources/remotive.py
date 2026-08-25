import httpx

from backend.scrapers.base import RawJob, ScraperAdapter
from backend.scrapers.registry import register

BASE_URL = "https://remotive.com/api/remote-jobs"


@register("remotive")
class RemotiveScraper(ScraperAdapter):
    name = "remotive"
    client_kind = "http"

    def __init__(self, client: httpx.AsyncClient | None = None):
        self.client = client or httpx.AsyncClient()

    async def fetch(
        self, keywords: list[str], location: str | None = None, limit: int = 25
    ) -> list[RawJob]:

        resp = await self.client.get(BASE_URL, params={"limit": 100})
        resp.raise_for_status()
        items = resp.json().get("jobs", [])

        needles = [k.lower() for k in keywords]
        jobs = []
        for item in items:
            title = item.get("title", "")
            tags = item.get("tags") or []
            tags_str = " ".join(tags).lower()
            if needles and not any(n in title.lower() or n in tags_str for n in needles):
                continue
            jobs.append(
                RawJob(
                    source=self.name,
                    external_id=str(item.get("id", "")),
                    title=title,
                    company=item.get("company_name", ""),
                    location=item.get("candidate_required_location", "Anywhere"),
                    url=item.get("url", ""),
                    description=item.get("description", ""),
                    posted_at=item.get("publication_date"),
                )
            )
            if len(jobs) >= limit:
                break
        return jobs
