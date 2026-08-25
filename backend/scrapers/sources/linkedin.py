from apify_client import ApifyClientAsync

from backend.scrapers.base import RawJob, ScraperAdapter
from backend.scrapers.registry import register

ACTOR_ID = "valig/linkedin-jobs-scraper"


@register("linkedin")
class LinkedInScraper(ScraperAdapter):
    name = "linkedin"
    client_kind = "apify"

    def __init__(self, client: ApifyClientAsync, country: str = "pk"):
        self.client = client
        self.country = country

    async def fetch(
        self, keywords: list[str], location: str | None = None, limit: int = 25
    ) -> list[RawJob]:
        seen: dict[str, RawJob] = {}
        actor = self.client.actor(ACTOR_ID)

        run = await actor.call(
            run_input={
                "country": self.country,
                "keywords": ", ".join(keywords),
                "location": location or "",
                "datePosted": "r604800",
                "limit": limit,
                "under10Applicants": False,
                "easyApply": False,
            }
        )
        if run is None:
            return []

        dataset = self.client.dataset(run.default_dataset_id)
        page = await dataset.list_items()

        for item in page.items:
            job = RawJob(
                source=self.name,
                external_id=item["id"],
                title=item["title"],
                company=item.get("companyName", ""),
                location=item.get("location", ""),
                url=item.get("applyUrl") or item["url"],
                description=item.get("description", ""),
                posted_at=item.get("postedDate"),
            )
            seen[job.external_id] = job  # dedupe across keyword calls

        return list(seen.values())
