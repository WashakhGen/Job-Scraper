import re

from fpdf import FPDF

# fpdf2's built-in core fonts (Helvetica etc.) only support Latin-1 — LLM
# output routinely uses smart quotes/dashes/ellipsis outside that range,
# which crashes write_html() otherwise. Normalize the common ones to their
# ASCII equivalents rather than bundling a Unicode TTF just for this.
_UNICODE_REPLACEMENTS = {
    "‘": "'",
    "’": "'",
    "“": '"',
    "”": '"',
    "–": "-",
    "—": "-",
    "…": "...",
    " ": " ",
}


def _sanitize_for_pdf(text: str) -> str:
    for unicode_char, ascii_equivalent in _UNICODE_REPLACEMENTS.items():
        text = text.replace(unicode_char, ascii_equivalent)
    # final safety net — drop anything else outside Latin-1 rather than crash
    return text.encode("latin-1", errors="ignore").decode("latin-1")


def cover_letter_to_html(text: str) -> str:
    """fpdf2's write_html() only understands a small HTML subset — convert the
    LLM's markdown-ish output (**bold**, `* ` bullets) into that subset."""
    text = _sanitize_for_pdf(text)
    html_parts: list[str] = []
    in_list = False
    for raw_line in text.split("\n"):
        line = raw_line.strip()
        if not line:
            if in_list:
                html_parts.append("</ul>")
                in_list = False
            continue
        bolded = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", line)
        if bolded.startswith("* "):
            if not in_list:
                html_parts.append("<ul>")
                in_list = True
            html_parts.append(f"<li>{bolded[2:]}</li>")
        else:
            if in_list:
                html_parts.append("</ul>")
                in_list = False
            html_parts.append(f"<p>{bolded}</p>")
    if in_list:
        html_parts.append("</ul>")
    return "".join(html_parts)


def build_pdf(
    body_html: str,
    *,
    name: str = "",
    headline: str = "",
    location: str = "",
    phone: str = "",
    email: str = "",
    links: list[str] | None = None,
) -> bytes:
    """Cover letter PDF: an optional letterhead (name/headline/contact line,
    only rendered if a name is set) followed by the letter body. Kept free of
    any DB/domain imports — callers pass plain values, not ORM rows."""
    pdf = FPDF()
    pdf.add_page()

    if name:
        pdf.set_font("Helvetica", "B", 16)
        pdf.cell(0, 8, _sanitize_for_pdf(name.upper()), align="C")
        pdf.ln(8)

        if headline:
            pdf.set_font("Helvetica", "", 11)
            pdf.cell(0, 6, _sanitize_for_pdf(headline), align="C")
            pdf.ln(6)

        contact_parts = [p for p in [location, phone, email, *(links or [])] if p]
        if contact_parts:
            pdf.set_font("Helvetica", "", 9)
            pdf.set_text_color(90, 90, 90)
            pdf.cell(0, 6, _sanitize_for_pdf(" | ".join(contact_parts)), align="C")
            pdf.set_text_color(0, 0, 0)
            pdf.ln(6)

        pdf.ln(2)
        pdf.set_draw_color(180, 180, 180)
        pdf.line(15, pdf.get_y(), 195, pdf.get_y())
        pdf.ln(6)

    pdf.set_font("Helvetica", size=11)
    pdf.write_html(body_html)
    return bytes(pdf.output())
