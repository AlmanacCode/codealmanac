import re
from dataclasses import dataclass
from urllib.parse import quote

from markdown_it import MarkdownIt
from markdown_it.token import Token

from codealmanac.services.wiki.links import resolve_page_href

CITATION_RE = re.compile(r"\[@([^\]\s]+)\]")


@dataclass(frozen=True)
class RenderedMarkdown:
    html: str
    citation_order: tuple[str, ...]


class RenderContext:
    def __init__(self):
        self._citation_numbers: dict[str, int] = {}
        self._citation_order: list[str] = []

    def citation_number(self, source_id: str) -> int:
        existing = self._citation_numbers.get(source_id)
        if existing is not None:
            return existing
        number = len(self._citation_order) + 1
        self._citation_numbers[source_id] = number
        self._citation_order.append(source_id)
        return number

    @property
    def citation_order(self) -> tuple[str, ...]:
        return tuple(self._citation_order)


class MarkdownRenderer:
    def __init__(self):
        # CommonMark has no tables; enable GFM pipe tables so wiki pages that
        # document APIs, schemas, and comparisons render as real <table>s
        # instead of leaking raw `| col | col |` pipe syntax as body text.
        self.markdown = MarkdownIt("commonmark", {"html": False, "linkify": False})
        self.markdown.enable("table")

    def render(
        self,
        body: str,
        *,
        page_id: str,
        title: str,
        source_is_folder_landing: bool,
    ) -> RenderedMarkdown:
        env: dict[str, object] = {}
        context = RenderContext()
        tokens = drop_leading_title_heading(self.markdown.parse(body, env), title)
        for token in tokens:
            if token.type == "inline" and token.children is not None:
                token.children = rewrite_citations(token.children, context)
                rewrite_page_links(
                    token.children,
                    page_id,
                    source_is_folder_landing=source_is_folder_landing,
                )
        html = self.markdown.renderer.render(tokens, self.markdown.options, env)
        return RenderedMarkdown(html=html, citation_order=context.citation_order)


def drop_leading_title_heading(tokens: list[Token], title: str) -> list[Token]:
    """Drop a leading ``# <title>`` heading that only repeats the page title.

    Pages open with an H1 matching their frontmatter title, and the viewer
    already renders that title in the page header, so the body's copy is pure
    duplication. Only an exact match is removed; a first heading that differs
    from the title (or isn't an H1) is left untouched.
    """
    if (
        len(tokens) >= 3
        and tokens[0].type == "heading_open"
        and tokens[0].tag == "h1"
        and tokens[1].type == "inline"
        and tokens[2].type == "heading_close"
        and tokens[1].content.strip() == title.strip()
    ):
        return tokens[3:]
    return tokens


def rewrite_citations(tokens: list[Token], context: RenderContext) -> list[Token]:
    rewritten: list[Token] = []
    for token in tokens:
        if token.type != "text":
            rewritten.append(token)
            continue
        rewritten.extend(rewrite_citation_text(token.content, context))
    return rewritten


def rewrite_citation_text(value: str, context: RenderContext) -> list[Token]:
    rewritten: list[Token] = []
    position = 0
    for match in CITATION_RE.finditer(value):
        if match.start() > position:
            rewritten.append(text_token(value[position : match.start()]))
        rewritten.extend(citation_tokens(match.group(1), context))
        position = match.end()
    if position < len(value):
        rewritten.append(text_token(value[position:]))
    return rewritten or [text_token(value)]


def citation_tokens(source_id: str, context: RenderContext) -> list[Token]:
    number = context.citation_number(source_id)
    source_ref = quote(source_id, safe="")
    opening = Token(
        "link_open",
        "a",
        1,
        attrs={
            "href": f"#source-{source_ref}",
            "class": "wiki-citation",
            "data-source-id": source_id,
        },
    )
    closing = Token("link_close", "a", -1)
    return [opening, text_token(f"[{number}]"), closing]


def text_token(value: str) -> Token:
    return Token("text", "", 0, content=value)


def rewrite_page_links(
    tokens: list[Token],
    page_id: str,
    *,
    source_is_folder_landing: bool,
) -> None:
    for token in tokens:
        if token.type != "link_open":
            continue
        page_link = resolve_page_href(
            token.attrGet("href") or "",
            page_id,
            source_is_folder_landing=source_is_folder_landing,
        )
        if page_link is not None:
            token.attrSet("href", f"#/page/{quote(page_link, safe='')}")
