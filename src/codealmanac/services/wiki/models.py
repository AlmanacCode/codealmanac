from enum import StrEnum
from pathlib import Path

from codealmanac.core.models import CodeAlmanacModel


class WikilinkKind(StrEnum):
    PAGE = "page"
    FILE = "file"
    FOLDER = "folder"
    CROSS_WIKI = "xwiki"


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


class PageLink(CodeAlmanacModel):
    kind: WikilinkKind
    target: str


class FileLink(CodeAlmanacModel):
    kind: WikilinkKind
    ref: FileReference


class FolderLink(CodeAlmanacModel):
    kind: WikilinkKind
    ref: FileReference


class CrossWikiLink(CodeAlmanacModel):
    kind: WikilinkKind
    wiki: str
    target: str


Wikilink = PageLink | FileLink | FolderLink | CrossWikiLink


class ParsedFrontmatter(CodeAlmanacModel):
    page_id: str | None = None
    title: str | None = None
    summary: str | None = None
    topics: tuple[str, ...] = ()
    files: tuple[str, ...] = ()
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
