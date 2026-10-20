import httpx

from backend.scrapers.base import RawJob, ScraperAdapter
from backend.scrapers.registry import register

BASE_URL = "https://apply.workable.com/api/v1/widget/accounts"


def _location(item: dict) -> str:
    parts = [p for p in [item.get("city"), item.get("country")] if p]
    loc = ", ".join(parts)
    if item.get("telecommuting"):
        return f"Remote ({loc})" if loc else "Remote"
    return loc


@register("workable")
class WorkableScraper(ScraperAdapter):
    name = "workable"
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
                    params={"details": "true"},
                    headers={"User-Agent": "Job-Scraper/1.0"},
                )
                resp.raise_for_status()
            except httpx.HTTPStatusError:
                # company slug wrong, or they've since left Workable — skip,
                continue

            data = resp.json()

            for item in data.get("jobs", []):
                title = item.get("title") or ""
                description = item.get("description") or ""
                haystack = f"{title} {description}".lower()
                if needles and not any(n in haystack for n in needles):
                    continue

                jobs.append(
                    RawJob(
                        source=self.name,
                        external_id=item.get("shortcode", ""),
                        title=title,
                        company=data.get("name") or company.replace("-", " ").title(),
                        location=_location(item),
                        url=item.get("shortlink") or item.get("url", ""),
                        description=description,
                        posted_at=item.get("published_on"),
                    )
                )

                if len(jobs) >= limit:
                    break

            if len(jobs) >= limit:
                break

        return jobs
