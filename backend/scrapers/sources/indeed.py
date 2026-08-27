from apify_client import ApifyClientAsync

from backend.scrapers.base import RawJob, ScraperAdapter
from backend.scrapers.registry import register

ACTOR_ID = "valig/indeed-jobs-scraper"


@register("indeed")
class IndeedScraper(ScraperAdapter):
    name = "indeed"
    client_kind = "apify"

    def __init__(self, client: ApifyClientAsync, country: str = "pk"):
        self.client = client
        self.country = country

    async def fetch(
        self, keywords: list[str], location: str | None = None, limit: int = 25
    ) -> list[RawJob]:
        seen: dict[str, RawJob] = {}
        actor = self.client.actor(ACTOR_ID)

        for keyword in keywords:
            run = await actor.call(
                run_input={
                    "country": self.country,
                    "title": keyword,
                    "location": location or "",
                    "datePosted": "7",
                    "limit": limit,
                }
            )
            if run is None:
                continue

            dataset = self.client.dataset(run.default_dataset_id)
            page = await dataset.list_items()

            for item in page.items:
                if item.get("expired"):
                    continue
                job = RawJob(
                    source=self.name,
                    external_id=item["key"],
                    title=item["title"],
                    company=(item.get("employer") or {}).get("name", ""),
                    location=(item.get("location") or {}).get("city", ""),
                    url=item["url"],
                    description=(item.get("description") or {}).get("text", ""),
                    posted_at=item.get("datePublished"),
                )
                seen[job.external_id] = job  # dedupe across keyword calls

        return list(seen.values())
