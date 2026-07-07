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
        self.markdown = MarkdownIt("commonmark", {"html": False, "linkify": False})

    def render(
        self,
        body: str,
        *,
        page_id: str,
        source_is_folder_landing: bool,
    ) -> RenderedMarkdown:
        env: dict[str, object] = {}
        context = RenderContext()
        tokens = self.markdown.parse(body, env)
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
