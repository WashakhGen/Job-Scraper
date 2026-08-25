from backend.scrapers.base import ScraperAdapter
from core.logging import log_main

SCRAPERS: dict[str, type[ScraperAdapter]] = {}


def register(name: str):
    def deco(cls: type[ScraperAdapter]) -> type[ScraperAdapter]:
        SCRAPERS[name] = cls
        log_main(f"Registered scraper: {name}")
        return cls

    return deco
