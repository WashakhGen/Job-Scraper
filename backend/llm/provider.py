import asyncio
from collections.abc import Awaitable, Callable, Sequence

from langchain_core.exceptions import ModelError, OutputParserException
from langchain_core.messages import BaseMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_ollama import ChatOllama
from pydantic import BaseModel

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


_MAX_RETRIES = 3
_RETRY_BASE_DELAY = 3.0  # seconds; doubles each attempt (3s, 6s, 12s)


def _is_retryable(exc: Exception) -> bool:
    if isinstance(exc, ModelError) and exc.is_retryable:
        return True
    # malformed/empty structured output — not a ModelError, but a known,
    # common, transient flake with local models (gemma via Ollama especially)
    return isinstance(exc, OutputParserException)


async def _retry_loop[T](make_call: Callable[[], Awaitable[T]]) -> T:
    """Shared retry/backoff shell."""
    last_exc: Exception | None = None

    for attempt in range(_MAX_RETRIES + 1):
        try:
            return await make_call()

        except Exception as exc:
            last_exc = exc

            if _is_retryable(exc) and attempt < _MAX_RETRIES:
                delay = _RETRY_BASE_DELAY * (2**attempt)
                log_main(
                    f"llm: {type(exc).__name__}, retrying in {delay:.0f}s "
                    f"({attempt + 1}/{_MAX_RETRIES})"
                )
                await asyncio.sleep(delay)
                continue

            break

    assert last_exc is not None
    raise last_exc


async def invoke_structured_with_retry[SchemaT: BaseModel](
    schema: type[SchemaT],
    messages: Sequence[BaseMessage] | str,
    *,
    temperature: float = 0.0,
) -> SchemaT:
    """Call an LLM for structured output, retrying transient failures with
    backoff
    """

    async def _call() -> SchemaT:
        llm = get_llm(temperature=temperature).with_structured_output(schema)
        await wait_for_rate_limit()
        result = await llm.ainvoke(messages)
        if not isinstance(result, schema):
            raise OutputParserException(
                f"Expected {schema.__name__}, got {type(result).__name__} — "
                "the model returned no usable structured output"
            )
        return result

    return await _retry_loop(_call)


async def invoke_text_with_retry(
    messages: Sequence[BaseMessage] | str,
    *,
    temperature: float = 0.0,
) -> str:
    """Plain-text LLM call with the same retry/backoff, plus the content
    shape handling Gemini needs: content sometimes comes back as
    list[dict] instead of a plain str."""

    async def _call() -> str:
        llm = get_llm(temperature=temperature)
        await wait_for_rate_limit()
        result = await llm.ainvoke(messages)
        content = result.content

        if isinstance(content, str) and content.strip():
            return content

        if isinstance(content, list):
            text_parts: list[str] = []
            for part in content:
                if isinstance(part, str):
                    text_parts.append(part)
                elif isinstance(part, dict) and part.get("type") == "text":
                    text_parts.append(part.get("text", ""))
            joined = "\n".join(text_parts)
            if joined.strip():
                return joined

        raise OutputParserException(
            f"Empty or unusable response content: {type(content).__name__} — {content!r}"
        )

    return await _retry_loop(_call)
