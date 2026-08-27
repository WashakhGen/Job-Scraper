class ScrapeState:
    """Tracks whether any scrape (manual or scheduled) is currently running,
    so a second one can't be kicked off on top of it — same active CV and
    same Apify budget either way."""

    def __init__(self) -> None:
        self.running = False

    def try_start(self) -> bool:
        if self.running:
            return False
        self.running = True
        return True

    def finish(self) -> None:
        self.running = False
