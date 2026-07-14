from markdown_it import MarkdownIt

from codealmanac.core.models import CodeAlmanacModel

MARKDOWN = MarkdownIt("commonmark", {"html": False, "linkify": False})


class WikiSection(CodeAlmanacModel):
    section_id: str
    ordinal: int
    heading_path: tuple[str, ...]
    body: str

    @property
    def heading(self) -> str:
        return " › ".join(self.heading_path)


class HeadingBoundary(CodeAlmanacModel):
    start_line: int
    content_start_line: int
    level: int
    title: str


def project_sections(body: str, page_title: str) -> tuple[WikiSection, ...]:
    """Project authored Markdown into stable, source-ordered search sections."""
    boundaries = heading_boundaries(body)
    if not boundaries:
        return (section(0, (page_title,), body),)

    lines = body.splitlines(keepends=True)
    sections: list[WikiSection] = []
    headings: dict[int, str] = {}

    first_heading = boundaries[0]
    preamble = "".join(lines[: first_heading.start_line])
    if preamble:
        sections.append(section(len(sections), (page_title,), preamble))

    for index, boundary in enumerate(boundaries):
        headings = {
            level: title for level, title in headings.items() if level < boundary.level
        }
        headings[boundary.level] = boundary.title
        heading_path = tuple(headings[level] for level in sorted(headings))
        next_start = (
            boundaries[index + 1].start_line
            if index + 1 < len(boundaries)
            else len(lines)
        )
        section_body = "".join(lines[boundary.content_start_line : next_start])
        sections.append(section(len(sections), heading_path, section_body))

    return tuple(sections)


def heading_boundaries(body: str) -> tuple[HeadingBoundary, ...]:
    tokens = MARKDOWN.parse(body)
    boundaries: list[HeadingBoundary] = []
    for index, token in enumerate(tokens):
        if token.type != "heading_open" or token.map is None:
            continue
        inline = tokens[index + 1]
        if inline.type != "inline":
            continue
        boundaries.append(
            HeadingBoundary(
                start_line=token.map[0],
                content_start_line=token.map[1],
                level=int(token.tag.removeprefix("h")),
                title=inline.content.strip(),
            )
        )
    return tuple(boundaries)


def section(
    ordinal: int,
    heading_path: tuple[str, ...],
    body: str,
) -> WikiSection:
    return WikiSection(
        section_id=f"{ordinal:04d}",
        ordinal=ordinal,
        heading_path=heading_path,
        body=body,
    )

