from datetime import UTC, datetime, timedelta

from apify_client import ApifyClientAsync

from backend.scrapers.base import RawJob, ScraperAdapter
from backend.scrapers.registry import register

ACTOR_ID = "valig/glassdoor-jobs-scraper"


@register("glassdoor")
class GlassDoorScraper(ScraperAdapter):
    name = "glassdoor"
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
            is_remote = location is not None and "remote" in location.lower()

            run_input: dict = {
                "daysOld": 30,
                "easyApply": False,
                "keywords": keyword,
                "limit": limit,
                "remoteWorkType": is_remote,
                "sortBy": "relevant_desc",
            }

            if not is_remote and location:
                run_input["location"] = location

            run = await actor.call(run_input=run_input)
            if run is None:
                continue

            dataset = self.client.dataset(run.default_dataset_id)
            page = await dataset.list_items()

            for item in page.items:
                if item.get("expired"):
                    continue
                job = RawJob(
                    source=self.name,
                    external_id=str(item["id"]),
                    title=item["title"],
                    company=item.get("employer", {}).get("name", ""),
                    location=item.get("location", {}).get("name")
                    or ("Remote" if is_remote else ""),
                    url=item["url"],
                    description=item.get("description", ""),
                    posted_at=(
                        datetime.now(UTC) - timedelta(days=item.get("ageInDays", 0))
                    ).isoformat(timespec="seconds"),
                )
                seen[job.external_id] = job  # dedupe across keyword calls

        return list(seen.values())
