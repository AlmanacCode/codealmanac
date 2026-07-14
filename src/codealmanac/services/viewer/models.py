from enum import StrEnum
from pathlib import Path

from pydantic import JsonValue

from codealmanac.core.models import CodeAlmanacModel


class ViewerFileKind(StrEnum):
    FILE = "file"
    DIRECTORY = "directory"


class ViewerRepository(CodeAlmanacModel):
    repository_id: str
    name: str
    root_path: Path


class ViewerPageSummary(CodeAlmanacModel):
    slug: str
    title: str | None
    summary: str | None
    path: str
    topics: tuple[str, ...]
    matched_heading: str | None = None
    excerpt: str | None = None


class ViewerTopicSummary(CodeAlmanacModel):
    slug: str
    title: str | None
    description: str | None
    page_count: int


class ViewerFileReference(CodeAlmanacModel):
    path: str
    is_dir: bool


class ViewerPageSource(CodeAlmanacModel):
    source_id: str
    source_type: str
    target: str | None
    title: str | None
    retrieved_at: str | None
    note: str | None
    citation_number: int | None


class ViewerOverview(CodeAlmanacModel):
    repository: ViewerRepository
    repositories: tuple[ViewerRepository, ...]
    page_count: int
    topic_count: int
    pages: tuple[ViewerPageSummary, ...]
    navigation_pages: tuple[ViewerPageSummary, ...]
    topics: tuple[ViewerTopicSummary, ...]
    featured_page: ViewerPageSummary | None


class ViewerPage(CodeAlmanacModel):
    repository: ViewerRepository
    slug: str
    title: str | None
    summary: str | None
    topics: tuple[str, ...]
    body: str
    html: str
    backlinks: tuple[str, ...]
    outgoing_links: tuple[str, ...]
    file_refs: tuple[ViewerFileReference, ...]
    sources: tuple[ViewerPageSource, ...]
    related_pages: tuple[ViewerPageSummary, ...]


class ViewerSearch(CodeAlmanacModel):
    repository: ViewerRepository
    query: str | None
    pages: tuple[ViewerPageSummary, ...]


class ViewerFile(CodeAlmanacModel):
    repository: ViewerRepository
    path: str
    kind: ViewerFileKind
    pages: tuple[ViewerPageSummary, ...]


class ViewerTopic(CodeAlmanacModel):
    repository: ViewerRepository
    slug: str
    title: str | None
    description: str | None
    parents: tuple[str, ...]
    children: tuple[str, ...]
    pages: tuple[ViewerPageSummary, ...]


class ViewerJobPageChanges(CodeAlmanacModel):
    created: tuple[str, ...] = ()
    updated: tuple[str, ...] = ()
    deleted: tuple[str, ...] = ()


class ViewerJobTranscript(CodeAlmanacModel):
    kind: str
    session_id: str | None
    transcript_path: Path | None


class ViewerJobRun(CodeAlmanacModel):
    run_id: str
    kind: str
    status: str
    title: str | None
    summary: str | None
    error: str | None
    created_at: str
    updated_at: str
    started_at: str | None
    finished_at: str | None
    page_changes: ViewerJobPageChanges | None
    harness_transcript: ViewerJobTranscript | None


class ViewerJobStep(CodeAlmanacModel):
    sequence: int
    timestamp: str
    kind: str
    title: str
    body: str | None
    detail: str | None
    actor: str | None
    tool: str | None
    target: str | None
    status: str | None
    input: str | None
    output: JsonValue | None
    error: bool


class ViewerJobs(CodeAlmanacModel):
    repository: ViewerRepository
    runs: tuple[ViewerJobRun, ...]


class ViewerJob(CodeAlmanacModel):
    repository: ViewerRepository
    run: ViewerJobRun
    steps: tuple[ViewerJobStep, ...]
