from enum import StrEnum
from pathlib import Path

from codealmanac.core.models import CodeAlmanacModel


class FileReference(CodeAlmanacModel):
    path: str
    original_path: str
    is_dir: bool


class PageSourceType(StrEnum):
    FILE = "file"
    WEB = "web"
    COMMIT = "commit"
    PR = "pr"
    ISSUE = "issue"
    CONVERSATION = "conversation"
    WIKI = "wiki"
    MANUAL = "manual"


class PageSource(CodeAlmanacModel):
    source_id: str
    source_type: PageSourceType
    target: str | None = None
    title: str | None = None
    retrieved_at: str | None = None
    note: str | None = None


class ParsedFrontmatter(CodeAlmanacModel):
    title: str | None = None
    summary: str | None = None
    topics: tuple[str, ...] = ()
    sources: tuple[PageSource, ...] = ()
    body: str


class PageDocument(CodeAlmanacModel):
    slug: str
    title: str
    summary: str | None
    file_path: Path
    relative_path: str
    content_hash: str
    updated_at: int
    topics: tuple[str, ...]
    sources: tuple[PageSource, ...]
    file_refs: tuple[FileReference, ...]
    page_links: tuple[str, ...]
    cross_wiki_links: tuple[tuple[str, str], ...]
    body: str
