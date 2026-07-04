from enum import StrEnum
from pathlib import Path

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.engine.harnesses.models import HarnessEvent


class ViewerFileKind(StrEnum):
    FILE = "file"
    DIRECTORY = "directory"


class ViewerWorkspace(CodeAlmanacModel):
    workspace_id: str
    name: str
    root_path: Path


class ViewerPageSummary(CodeAlmanacModel):
    slug: str
    title: str | None
    summary: str | None
    path: str
    topics: tuple[str, ...]


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


class ViewerOverview(CodeAlmanacModel):
    workspace: ViewerWorkspace
    workspaces: tuple[ViewerWorkspace, ...]
    page_count: int
    topic_count: int
    pages: tuple[ViewerPageSummary, ...]
    navigation_pages: tuple[ViewerPageSummary, ...]
    topics: tuple[ViewerTopicSummary, ...]
    featured_page: ViewerPageSummary | None


class ViewerPage(CodeAlmanacModel):
    workspace: ViewerWorkspace
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
    workspace: ViewerWorkspace
    query: str | None
    pages: tuple[ViewerPageSummary, ...]


class ViewerFile(CodeAlmanacModel):
    workspace: ViewerWorkspace
    path: str
    kind: ViewerFileKind
    pages: tuple[ViewerPageSummary, ...]


class ViewerTopic(CodeAlmanacModel):
    workspace: ViewerWorkspace
    slug: str
    title: str | None
    description: str | None
    parents: tuple[str, ...]
    children: tuple[str, ...]
    pages: tuple[ViewerPageSummary, ...]


class ViewerRunPageChanges(CodeAlmanacModel):
    created: tuple[str, ...] = ()
    updated: tuple[str, ...] = ()
    deleted: tuple[str, ...] = ()


class ViewerRunTranscript(CodeAlmanacModel):
    kind: str
    session_id: str | None
    transcript_path: Path | None


class ViewerRunRecord(CodeAlmanacModel):
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
    log_path: Path
    page_changes: ViewerRunPageChanges | None
    harness_transcript: ViewerRunTranscript | None


class ViewerRunEvent(CodeAlmanacModel):
    sequence: int
    timestamp: str
    kind: str
    message: str
    harness_event: HarnessEvent | None


class ViewerRuns(CodeAlmanacModel):
    workspace: ViewerWorkspace
    runs: tuple[ViewerRunRecord, ...]


class ViewerRun(CodeAlmanacModel):
    workspace: ViewerWorkspace
    run: ViewerRunRecord
    events: tuple[ViewerRunEvent, ...]
