import asyncio

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_ollama import ChatOllama

from core.logging import log_main
from core.settings import SETTINGS


class LLMConfigError(Exception):
    """Raised when the configured LLM provider is missing required settings."""


class _RateLimiter:
    """Paces calls to at most `rate_per_minute`, evenly spaced — not just
    capped-per-window. Shared across every caller (scoring + cover letters
    both draw from the same per-project Gemini quota), so this lives here
    rather than inside any one module that happens to call the LLM."""

    def __init__(self, rate_per_minute: int) -> None:
        self._interval = 60.0 / rate_per_minute
        self._lock = asyncio.Lock()
        self._next_slot = 0.0

    async def wait(self) -> None:
        async with self._lock:
            loop = asyncio.get_event_loop()
            now = loop.time()
            start = max(now, self._next_slot)
            self._next_slot = start + self._interval
            delay = start - now
        if delay > 0:
            await asyncio.sleep(delay)


_gemini_rate_limiter = _RateLimiter(SETTINGS.GEMINI_RATE_LIMIT_PER_MINUTE)


async def wait_for_rate_limit() -> None:
    """Call this immediately before every LLM invocation. No-op for Ollama,
    which runs locally with no external quota to respect."""
    if SETTINGS.LLM_PROVIDER.lower() == "gemini":
        await _gemini_rate_limiter.wait()


def get_llm(temperature: float = 0.0):

    provider = SETTINGS.LLM_PROVIDER.lower()
    if provider == "ollama":
        log_main(
            f"llm: using ollama model={SETTINGS.OLLAMA_MODEL!r} at {SETTINGS.OLLAMA_API_URL!r}"
        )
        return ChatOllama(
            model=SETTINGS.OLLAMA_MODEL,
            validate_model_on_init=True,
            base_url=SETTINGS.OLLAMA_API_URL,
            temperature=temperature,
            seed=42,
        )

    if provider == "gemini":
        if not SETTINGS.GEMINI_API_KEY:
            log_main("llm: GEMINI_API_KEY is empty, cannot use gemini provider")
            raise LLMConfigError(
                "LLM_PROVIDER is 'gemini' but GEMINI_API_KEY is empty — set it in .env"
            )

        log_main(f"llm: using gemini model='{SETTINGS.GEMINI_MODEL}'")
        return ChatGoogleGenerativeAI(
            model=SETTINGS.GEMINI_MODEL, api_key=SETTINGS.GEMINI_API_KEY, temperature=temperature
        )

    log_main(f"llm: unknown LLM_PROVIDER={provider!r}")
    raise LLMConfigError(f"Unknown LLM_PROVIDER={provider!r} — expected 'ollama' or 'gemini'")
