from pydantic import BaseModel, Field

from backend.llm.provider import invoke_structured_with_retry


class CVKeywords(BaseModel):
    keywords: list[str] = Field(
        description="3-6 concise job title search phrase"
        " (e.g. 'AI Engineer', 'Backend Developer') "
        "this candidate is qualified for and would search job boards with "
        "— actual job titles, not raw skills."
    )


async def extract_keywords(cv_text: str) -> list[str]:
    result = await invoke_structured_with_retry(
        CVKeywords,
        f"""You are a job-search assistant. Read the CV below and extract job title search phrases
            suitable for searching job boards (LinkedIn, Indeed, etc.).
        Rules:
        - Return ONLY job titles the candidate is genuinely qualified for, based on their actual
        experience level and skills.
        - Match seniority to the CV. Do not suggest "Senior" or "Lead" titles unless
        the experience clearly supports them.
        - Use common, real-world job board titles that recruiters actually 
        search (e.g. "Machine Learning Engineer", not "AI Wizard").
        - Include close variations and adjacent roles the candidate could realistically land,
          ordered from best-fit to broader-fit.
        - Keep each title short (2-4 words), the way it would appear in a job posting.

        Example output:
        ["Machine Learning Engineer", "AI Engineer", "Backend Engineer (Python)"]

        CV:
        {cv_text}""",
    )
    return result.keywords
