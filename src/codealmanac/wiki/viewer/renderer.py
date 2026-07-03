import re
from urllib.parse import quote

from markdown_it import MarkdownIt
from markdown_it.token import Token

from codealmanac.wiki.models import (
    CrossWikiLink,
    FileLink,
    FolderLink,
    PageLink,
)
from codealmanac.wiki.wikilinks import classify_wikilink

WIKILINK_RE = re.compile(r"\[\[([^\]\n]+)\]\]")


class MarkdownRenderer:
    def __init__(self):
        self.markdown = MarkdownIt("commonmark", {"html": False, "linkify": False})

    def render(self, body: str) -> str:
        env: dict[str, object] = {}
        tokens = self.markdown.parse(body, env)
        for token in tokens:
            if token.type == "inline" and token.children is not None:
                token.children = rewrite_wikilinks(token.children)
        return self.markdown.renderer.render(tokens, self.markdown.options, env)


def rewrite_wikilinks(tokens: list[Token]) -> list[Token]:
    rewritten: list[Token] = []
    for token in tokens:
        if token.type != "text":
            rewritten.append(token)
            continue
        rewritten.extend(rewrite_text_token(token.content))
    return rewritten


def rewrite_text_token(value: str) -> list[Token]:
    rewritten: list[Token] = []
    position = 0
    for match in WIKILINK_RE.finditer(value):
        if match.start() > position:
            rewritten.append(text_token(value[position : match.start()]))
        rewritten.extend(tokens_for_wikilink_match(match))
        position = match.end()
    if position < len(value):
        rewritten.append(text_token(value[position:]))
    return rewritten or [text_token(value)]


def tokens_for_wikilink_match(match: re.Match[str]) -> list[Token]:
    raw = match.group(1)
    link = classify_wikilink(raw)
    if link is None:
        return [text_token(match.group(0))]
    label = wikilink_label(raw)
    if isinstance(link, PageLink):
        slug = quote(link.target, safe="")
        return link_tokens(label, f"#/page/{slug}")
    if isinstance(link, FileLink | FolderLink):
        return [code_token(label)]
    if isinstance(link, CrossWikiLink):
        return [code_token(label)]
    return [text_token(match.group(0))]


def text_token(value: str) -> Token:
    return Token("text", "", 0, content=value)


def code_token(value: str) -> Token:
    return Token("code_inline", "code", 0, content=value)


def link_tokens(label: str, href: str) -> list[Token]:
    opening = Token("link_open", "a", 1, attrs={"href": href})
    closing = Token("link_close", "a", -1)
    return [opening, text_token(label), closing]


def wikilink_label(raw: str) -> str:
    target, separator, label = raw.partition("|")
    if separator:
        return label.strip() or target.strip()
    return target.strip()

