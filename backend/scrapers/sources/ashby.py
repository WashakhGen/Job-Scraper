import httpx

from backend.scrapers.base import RawJob, ScraperAdapter
from backend.scrapers.registry import register

BASE_URL = "https://api.ashbyhq.com/posting-api/job-board"


@register("ashby")
class AshbyScraper(ScraperAdapter):
    name = "ashby"
    client_kind = "http"

    def __init__(self, client: httpx.AsyncClient | None = None, companies: list[str] | None = None):
        self.client = client or httpx.AsyncClient()
        self.companies = companies or []

    async def fetch(
        self, keywords: list[str], location: str | None = None, limit: int = 25
    ) -> list[RawJob]:
        if not self.companies:
            return []

        needles = [k.lower() for k in keywords]
        jobs: list[RawJob] = []

        for company in self.companies:
            company = company.strip()
            if not company:
                continue

            try:
                resp = await self.client.get(
                    f"{BASE_URL}/{company}",
                    params={"includeCompensation": "false"},
                    headers={"User-Agent": "Job-Scraper/1.0"},
                )
                resp.raise_for_status()
            except httpx.HTTPStatusError:
                # company slug wrong, or they've since left Ashby — skip,
                # one bad slug shouldn't break the rest of the batch
                continue

            data = resp.json()

            for item in data.get("jobs", []):
                if not item.get("isListed", True):
                    continue

                title = item.get("title") or ""
                description = item.get("descriptionPlain") or ""
                haystack = f"{title} {description}".lower()
                if needles and not any(n in haystack for n in needles):
                    continue

                jobs.append(
                    RawJob(
                        source=self.name,
                        external_id=str(item.get("id", "")),
                        title=title,
                        company=company.replace("-", " ").title(),
                        location=item.get("location") or ("Remote" if item.get("isRemote") else ""),
                        url=item.get("jobUrl", ""),
                        description=description,
                        posted_at=item.get("publishedAt"),
                    )
                )

                if len(jobs) >= limit:
                    break

            if len(jobs) >= limit:
                break

        return jobs
