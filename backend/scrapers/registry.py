from backend.core.logging import log_main
from backend.scrapers.base import ScraperAdapter

SCRAPERS: dict[str, type[ScraperAdapter]] = {}


def register(name: str):
    def deco(cls: type[ScraperAdapter]) -> type[ScraperAdapter]:
        SCRAPERS[name] = cls
        log_main(f"Registered scraper: {name}")
        return cls

    return deco
