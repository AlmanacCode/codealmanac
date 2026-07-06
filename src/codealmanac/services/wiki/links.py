from pathlib import PurePosixPath
from urllib.parse import unquote, urlsplit

from markdown_it import MarkdownIt
from markdown_it.token import Token

MARKDOWN = MarkdownIt("commonmark", {"html": False, "linkify": False})


def extract_page_links(
    body: str,
    source_page_id: str,
    *,
    source_is_folder_landing: bool,
) -> tuple[str, ...]:
    links: list[str] = []
    tokens = MARKDOWN.parse(body)
    for token in tokens:
        if token.type == "inline" and token.children is not None:
            links.extend(
                link
                for link in extract_inline_page_links(
                    token.children,
                    source_page_id,
                    source_is_folder_landing=source_is_folder_landing,
                )
                if link is not None
            )
    return tuple(links)


def extract_inline_page_links(
    tokens: list[Token],
    source_page_id: str,
    *,
    source_is_folder_landing: bool,
) -> tuple[str | None, ...]:
    return tuple(
        resolve_page_href(
            token.attrGet("href") or "",
            source_page_id,
            source_is_folder_landing=source_is_folder_landing,
        )
        for token in tokens
        if token.type == "link_open"
    )


def resolve_page_href(
    href: str,
    source_page_id: str,
    *,
    source_is_folder_landing: bool,
) -> str | None:
    raw = href.strip()
    if not raw or raw.startswith(("#", "/")) or "\\" in raw:
        return None
    parsed = urlsplit(raw)
    if parsed.scheme or parsed.netloc or parsed.query:
        return None
    path = unquote(parsed.path).strip("/")
    if not path or path_has_file_suffix(path) or " " in path:
        return None
    return resolve_relative_page_path(
        path,
        page_base_parts(source_page_id, source_is_folder_landing),
    )


def page_base_parts(source_page_id: str, source_is_folder_landing: bool) -> list[str]:
    if source_page_id == "README":
        return []
    parts = source_page_id.split("/")
    if source_is_folder_landing:
        return parts
    return parts[:-1]


def resolve_relative_page_path(path: str, base_parts: list[str]) -> str | None:
    resolved = list(base_parts)
    for part in PurePosixPath(path).parts:
        if part in {"", "."}:
            continue
        if part == "..":
            if not resolved:
                return None
            resolved.pop()
            continue
        resolved.append(part)
    if not resolved:
        return None
    return "/".join(resolved)


def path_has_file_suffix(path: str) -> bool:
    return PurePosixPath(path).name.count(".") > 0
