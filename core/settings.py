from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # database
    DATABASE_URL: str = "sqlite:///./jobscrapper.db"

    # llm
    LLM_PROVIDER: str = "gemini"  # gemini | ollama

    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = ""
    # free tier 15 req/min per project
    # under that (raise it in .env if you're on a paid tier with a higher cap)
    GEMINI_RATE_LIMIT_PER_MINUTE: int = 14

    OLLAMA_API_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3"

    # apify
    APIFY_API_TOKEN: str = ""
    APIFY_RESULT_LIMIT: int = 25

    # scoring / scheduling
    MIN_SCORE: int = 70
    SCRAPE_CRON_DEFAULT: str = "0 2 * * *"

    UVICORN_PORT: int = 8888

    # logs
    LOG_DIR: str = "./logs"

    # CV Uploads
    MAX_CVS: int = 3
    CV_UPLOAD_DIR: str = "./media/cvs"


SETTINGS = Settings()
