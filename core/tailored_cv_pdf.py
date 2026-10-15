import html as html_lib
import re
from dataclasses import dataclass, field

from weasyprint import HTML

# matches the "### Title — Org :: Date range" line from the canonical schema
# backend/llm/tailored_cv.py instructs the model to emit
_ENTRY_RE = re.compile(r"^###\s+(.+)$")
_SECTION_RE = re.compile(r"^##\s+(.+)$")
_SUBTITLE_RE = re.compile(r"^_(.+)_$")
_SKILL_LINE_RE = re.compile(r"^\*\*(.+?):\*\*\s*(.*)$")
_BULLET_RE = re.compile(r"^[-*]\s+(.*)$")


def _strip_bold_markers(text: str) -> str:
    return re.sub(r"\*\*(.+?)\*\*", r"\1", text).strip()


@dataclass
class _Entry:
    title: str
    date: str = ""
    subtitle: str = ""
    bullets: list[str] = field(default_factory=list)


@dataclass
class _Section:
    name: str
    paragraphs: list[str] = field(default_factory=list)
    bullets: list[str] = field(default_factory=list)
    skill_lines: list[tuple[str, str]] = field(default_factory=list)
    entries: list[_Entry] = field(default_factory=list)


@dataclass
class _ParsedCV:
    name: str = ""
    headline: str = ""
    contact: list[str] = field(default_factory=list)
    sections: list[_Section] = field(default_factory=list)


def _parse_tailored_cv(markdown: str) -> _ParsedCV:
    lines = [line.strip() for line in markdown.split("\n")]
    parsed = _ParsedCV()
    header_lines_seen = 0  # 0=name, 1=headline, 2=contact, 3+=ignored until first section

    for line in lines:
        if not line:
            continue

        if line.startswith("# "):
            parsed.name = _strip_bold_markers(line[2:])
            continue

        section_match = _SECTION_RE.match(line)
        if section_match:
            parsed.sections.append(_Section(name=_strip_bold_markers(section_match.group(1))))
            continue

        if not parsed.sections:
            # still in the header block (name/headline/contact), before any section
            if header_lines_seen == 0:
                parsed.headline = line
            elif header_lines_seen == 1:
                parsed.contact = [p.strip() for p in line.split("|") if p.strip()]
            header_lines_seen += 1
            continue

        section = parsed.sections[-1]

        entry_match = _ENTRY_RE.match(line)
        if entry_match:
            title_line = entry_match.group(1)
            if "::" in title_line:
                title_part, date_part = title_line.split("::", 1)
            else:
                title_part, date_part = title_line, ""
            section.entries.append(
                _Entry(title=_strip_bold_markers(title_part), date=date_part.strip())
            )
            continue

        subtitle_match = _SUBTITLE_RE.match(line)
        if subtitle_match and section.entries:
            section.entries[-1].subtitle = subtitle_match.group(1).strip()
            continue

        skill_match = _SKILL_LINE_RE.match(line)
        if skill_match:
            section.skill_lines.append((skill_match.group(1).strip(), skill_match.group(2).strip()))
            continue

        bullet_match = _BULLET_RE.match(line)
        if bullet_match:
            bullet_text = bullet_match.group(1).strip()
            if section.entries:
                section.entries[-1].bullets.append(bullet_text)
            else:
                section.bullets.append(bullet_text)
            continue

        # plain paragraph line
        if section.entries:
            # stray prose after an entry started — append to its last bullet
            # rather than dropping it (defensive, shouldn't normally happen)
            section.entries[-1].bullets.append(line)
        else:
            section.paragraphs.append(line)

    return parsed


_BRACKET_RE = re.compile(r"\[\w+\]")


def _pop_link(label: str, link_pool: dict[str, list[str]]) -> str | None:
    """Consumes the next URL queued for this label, in document order. A
    generic marker like "[Code]" repeats across multiple project bullets
    pointing at different repos — a single label->URL dict can't tell those
    apart, so link_pool holds a list per label and this pops one at a time,
    matching the order the tailoring prompt is required to preserve."""
    urls = link_pool.get(label)
    if not urls:
        return None
    return urls.pop(0)


def _link_brackets(escaped_text: str, link_pool: dict[str, list[str]]) -> str:
    """Wraps bracket markers like [Live]/[Code] in a link — these are
    unambiguous (real prose never uses bare "[Word]" syntax), unlike a
    label such as "GitHub" which also shows up as a product name in body
    text (e.g. "GitHub Actions (CI/CD)") and must never be substring-matched."""

    def _wrap(match: re.Match[str]) -> str:
        label = match.group(0)
        url = _pop_link(label, link_pool)
        if url is None:
            return label
        return f'<a href="{html_lib.escape(url, quote=True)}">{label}</a>'

    return _BRACKET_RE.sub(_wrap, escaped_text)


def _inline_html(text: str, link_pool: dict[str, list[str]]) -> str:
    """Escapes + bolds the text, then links it only in two safe, unambiguous
    cases: the whole (trimmed) text exactly matches a link label (contact
    segments like "GitHub", certification bullets), or it contains a bracket
    marker like [Live]/[Code]. Never a generic substring match — that's what
    produced false positives like linking "GitHub" inside "GitHub Actions"."""
    whole_line_key = text.strip().rstrip(":").strip()
    escaped = html_lib.escape(text)
    escaped = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", escaped)
    escaped = _link_brackets(escaped, link_pool)

    url = _pop_link(whole_line_key, link_pool)
    if url is not None:
        return f'<a href="{html_lib.escape(url, quote=True)}">{escaped}</a>'
    return escaped


_CSS = """
@page { size: Letter; margin: 15mm 14mm; }
body {
    font-family: 'Liberation Sans', Helvetica, Arial, sans-serif;
    font-size: 9.5pt;
    color: #1a1a1a;
    line-height: 1.35;
}
.cv-name { text-align: center; font-size: 20pt; font-weight: bold; color: #1f3a5f; margin: 0; }
.cv-headline { text-align: center; font-size: 10.5pt; margin: 2px 0; }
.cv-contact { text-align: center; font-size: 9pt; color: #444; margin: 2px 0 10px; }
.cv-contact a, .cv-body a { color: #1a5fb4; text-decoration: underline; }
h2.cv-section {
    font-size: 11pt;
    font-weight: bold;
    letter-spacing: 0.4px;
    color: #1f3a5f;
    border-bottom: 1.2px solid #1f3a5f;
    margin: 12px 0 5px;
    padding-bottom: 2px;
    break-after: avoid;
}
.cv-entry-header {
    display: flex; justify-content: space-between; font-weight: bold; margin-top: 6px;
    break-after: avoid;
    break-inside: avoid;
}
.cv-entry-date { font-weight: normal; color: #555; white-space: nowrap; }
.cv-subtitle { font-style: italic; color: #444; margin: 1px 0 3px; break-after: avoid; }
ul { margin: 2px 0 8px 16px; padding: 0; }
li { margin-bottom: 3px; break-inside: avoid; }
p { margin: 2px 0 8px; }
.cv-skill-line { margin: 2px 0; }
.cv-skill-category { font-weight: bold; }
"""


def _render_section_body_html(section: _Section, link_pool: dict[str, list[str]]) -> str:
    parts: list[str] = []
    for para in section.paragraphs:
        parts.append(f"<p>{_inline_html(para, link_pool)}</p>")
    for category, items in section.skill_lines:
        category_html = html_lib.escape(category)
        parts.append(
            f'<p class="cv-skill-line"><span class="cv-skill-category">{category_html}:</span> '
            f"{_inline_html(items, link_pool)}</p>"
        )
    if section.bullets:
        items_html = "".join(f"<li>{_inline_html(b, link_pool)}</li>" for b in section.bullets)
        parts.append(f"<ul>{items_html}</ul>")
    for entry in section.entries:
        parts.append(
            f'<div class="cv-entry-header"><span>{_inline_html(entry.title, link_pool)}</span>'
            f'<span class="cv-entry-date">{html_lib.escape(entry.date)}</span></div>'
        )
        if entry.subtitle:
            parts.append(f'<p class="cv-subtitle">{_inline_html(entry.subtitle, link_pool)}</p>')
        if entry.bullets:
            items_html = "".join(f"<li>{_inline_html(b, link_pool)}</li>" for b in entry.bullets)
            parts.append(f"<ul>{items_html}</ul>")
    return "".join(parts)


def build_tailored_cv_pdf(tailored_markdown: str, link_map: dict[str, list[str]]) -> bytes:
    """Renders the canonical-schema tailored CV (see backend/llm/tailored_cv.py)
    as a styled PDF via weasyprint — real HTML/CSS, so it can carry colors,
    right-aligned dates, and real hyperlinks (from link_map, extracted from
    the original CV's PDF annotations) much closer to the original's look
    than the earlier fpdf2 plain-text renderer."""
    parsed = _parse_tailored_cv(tailored_markdown)
    # per-call mutable copy — link_map is the cached, reusable extraction
    # result, but consuming a pooled label (e.g. "[Code]") must drain a
    # fresh copy each render, not the shared cached lists
    link_pool: dict[str, list[str]] = {label: list(urls) for label, urls in link_map.items()}

    # built in document order — link_pool is consumed label-by-label as each
    # part renders, so this order must match the page's actual top-to-bottom
    # reading order for repeated labels (e.g. "[Code]") to resolve correctly
    contact_html = " | ".join(_inline_html(part, link_pool) for part in parsed.contact)
    sections_html = "".join(
        f'<h2 class="cv-section">{html_lib.escape(section.name)}</h2>'
        f'<div class="cv-body">{_render_section_body_html(section, link_pool)}</div>'
        for section in parsed.sections
    )

    document = f"""<!doctype html>
<html>
<head><meta charset="utf-8"><style>{_CSS}</style></head>
<body>
<div class="cv-name">{html_lib.escape(parsed.name)}</div>
<div class="cv-headline">{html_lib.escape(parsed.headline)}</div>
<div class="cv-contact">{contact_html}</div>
{sections_html}
</body>
</html>"""

    pdf_bytes = HTML(string=document).write_pdf()
    assert pdf_bytes is not None  # only None when writing to a target file, which we don't do
    return pdf_bytes
