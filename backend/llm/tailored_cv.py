from backend.llm.claude_cli import invoke_claude_cli

_SCHEMA = """\
# Full Name
Headline line (role/title)
Contact segments separated by " | " (location, phone, email, links — whatever the original has)

## SECTION NAME (use the original's own section names and order)
A plain paragraph, OR a bullet list, OR skill-category lines, OR entries shaped like:

### Title — Organization :: Date range
_Optional italic subtitle line_
- bullet
- bullet
"""

_INSTRUCTIONS = f"""\
You are tailoring a candidate's CV for a specific job application, and normalizing its
formatting into a clean canonical schema. Follow these rules exactly:

1. Output ONLY in this canonical markdown schema — no preamble, no commentary:
{_SCHEMA}
2. Use "::" exactly as shown to separate a title/organization from its date range — this
   is a strict machine-parsed delimiter, not stylistic. Put a line break between every job
   or education entry, between the entry header and the bullets.
3. Reproduce the EXACT same sections, section order, and entries as the original CV below
   — do not add, remove, or reorder any section, entry, or bullet. If a bullet's text was
   broken across lines by PDF extraction (a wrapped sentence with no bullet marker on the
   continuation), merge it back into a single bullet — this is a formatting fix, not a
   content change.
4. Read the job description below and identify the skills, tools, and requirements it
   actually asks for. Only reword the SUMMARY paragraph and the wording of existing
   experience bullets to naturally foreground whichever of those the candidate's real,
   existing experience already supports — do not invent new employers, dates, numbers,
   projects, and do not claim a requirement the CV gives no real basis for.
   Everything else (skills, education, certifications, contact info, dates) must be copied
   verbatim from the original, including any trailing text like "[Live]" or "[Code]" markers.
5. Keep every fact (employers, dates, metrics, project names) exactly as written in the
   original."""


async def tailor_cv(
    cv_markdown: str,
    job_title: str,
    company: str,
    job_description: str,
) -> str:
    prompt = (
        f"{_INSTRUCTIONS}\n\n"
        f"Job: {job_title} at {company}\n\n"
        f"Job description:\n{job_description}\n\n"
        f"Original CV:\n{cv_markdown}\n"
    )
    return await invoke_claude_cli(prompt)
