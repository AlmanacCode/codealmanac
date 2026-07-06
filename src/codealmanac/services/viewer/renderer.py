from urllib.parse import quote

from markdown_it import MarkdownIt
from markdown_it.token import Token

from codealmanac.services.wiki.links import resolve_page_href


class MarkdownRenderer:
    def __init__(self):
        self.markdown = MarkdownIt("commonmark", {"html": False, "linkify": False})

    def render(
        self,
        body: str,
        *,
        page_id: str,
        source_is_folder_landing: bool,
    ) -> str:
        env: dict[str, object] = {}
        tokens = self.markdown.parse(body, env)
        for token in tokens:
            if token.type == "inline" and token.children is not None:
                rewrite_page_links(
                    token.children,
                    page_id,
                    source_is_folder_landing=source_is_folder_landing,
                )
        return self.markdown.renderer.render(tokens, self.markdown.options, env)


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
