from langchain_core.messages import HumanMessage, SystemMessage

from backend.llm.provider import invoke_text_with_retry

_SYSTEM = """\
You write concise, natural cover letters for job applications on behalf of a candidate.
Keep it under 200 words, professional but not stiff. Reference 2-3 concrete matches
between the candidate's background and the role no generic filler, no placeholder
brackets like [Company Name] left unfilled."""


async def generate_cover_letter(
    cv_text: str,
    job_title: str,
    company: str,
    matched: list[str],
    missing: list[str],
) -> str:
    matched_str = ", ".join(matched) or "none identified"
    missing_str = ", ".join(missing) or "none identified"

    return await invoke_text_with_retry(
        [
            SystemMessage(content=_SYSTEM),
            HumanMessage(
                content=(
                    f"CV:\n{cv_text}\n\n"
                    f"Company: {company}\n"
                    f"Job title: {job_title}\n\n"
                    f"Requirements this candidate matches: {matched_str}\n"
                    f"Requirements this candidate is missing: {missing_str}"
                )
            ),
        ],
        temperature=0.5,
    )
