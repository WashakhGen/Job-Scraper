from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_ollama import ChatOllama

from core.logging import log_main
from core.settings import SETTINGS


class LLMConfigError(Exception):
    """Raised when the configured LLM provider is missing required settings."""


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
