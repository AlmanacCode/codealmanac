from enum import StrEnum
from pathlib import Path

from codealmanac.core.models import CodeAlmanacModel


class HealthCategory(StrEnum):
    ORPHANS = "orphans"
    DEAD_REFS = "dead_refs"
    BROKEN_LINKS = "broken_links"
    BROKEN_XWIKI = "broken_xwiki"
    EMPTY_TOPICS = "empty_topics"
    EMPTY_PAGES = "empty_pages"


class SearchPageResult(CodeAlmanacModel):
    slug: str
    title: str | None
    summary: str | None
    updated_at: int
    archived_at: int | None
    superseded_by: str | None
    topics: tuple[str, ...]


class PageFileReference(CodeAlmanacModel):
    path: str
    is_dir: bool


class CrossWikiReference(CodeAlmanacModel):
    wiki: str
    target: str


class PageView(CodeAlmanacModel):
    slug: str
    title: str | None
    summary: str | None
    file_path: Path
    updated_at: int
    archived_at: int | None
    superseded_by: str | None
    topics: tuple[str, ...]
    file_refs: tuple[PageFileReference, ...]
    wikilinks_out: tuple[str, ...]
    wikilinks_in: tuple[str, ...]
    cross_wiki_links: tuple[CrossWikiReference, ...]
    body: str


class IndexRefreshResult(CodeAlmanacModel):
    changed: int
    removed: int
    pages_indexed: int
    files_seen: int
    files_skipped: int


class IndexCounts(CodeAlmanacModel):
    pages: int
    topics: int


class IndexSummary(CodeAlmanacModel):
    pages: int
    topics: int
    files_seen: int
    files_skipped: int


class TopicSummary(CodeAlmanacModel):
    slug: str
    title: str | None
    description: str | None
    page_count: int


class TopicDetail(CodeAlmanacModel):
    slug: str
    title: str | None
    description: str | None
    parents: tuple[str, ...]
    children: tuple[str, ...]
    pages: tuple[str, ...]


class OrphanPage(CodeAlmanacModel):
    slug: str


class DeadFileReference(CodeAlmanacModel):
    slug: str
    path: str


class BrokenPageLink(CodeAlmanacModel):
    source_slug: str
    target_slug: str


class BrokenCrossWikiLink(CodeAlmanacModel):
    source_slug: str
    target_wiki: str
    target_slug: str


class EmptyTopic(CodeAlmanacModel):
    slug: str


class EmptyPage(CodeAlmanacModel):
    slug: str


class HealthReport(CodeAlmanacModel):
    orphans: tuple[OrphanPage, ...]
    dead_refs: tuple[DeadFileReference, ...]
    broken_links: tuple[BrokenPageLink, ...]
    broken_xwiki: tuple[BrokenCrossWikiLink, ...]
    empty_topics: tuple[EmptyTopic, ...]
    empty_pages: tuple[EmptyPage, ...]
