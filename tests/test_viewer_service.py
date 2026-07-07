import shutil
from pathlib import Path

import pytest
from conftest import initialize_repository
from pydantic import ValidationError

from codealmanac.app import CodeAlmanac
from codealmanac.services.harnesses.models import (
    HarnessEvent,
    HarnessEventKind,
    HarnessKind,
    HarnessTranscriptRef,
)
from codealmanac.services.runs.models import RunEventKind, RunKind, RunStatus
from codealmanac.services.runs.requests import (
    FinishRunRequest,
    MarkRunRunningRequest,
    RecordRunEventRequest,
    RecordRunHarnessTranscriptRequest,
    StartRunRequest,
)
from codealmanac.services.viewer.requests import (
    ViewerFileRequest,
    ViewerJobRequest,
    ViewerJobsRequest,
    ViewerOverviewRequest,
    ViewerPageRequest,
    ViewerSearchRequest,
    ViewerTopicRequest,
)


def test_viewer_overview_search_and_topic_use_index_read_model(
    viewer_repo: tuple[Path, CodeAlmanac],
):
    repo, app = viewer_repo

    overview = app.viewer.overview(ViewerOverviewRequest(cwd=repo))
    search = app.viewer.search(ViewerSearchRequest(cwd=repo, query="login"))
    topic = app.viewer.topic(ViewerTopicRequest(cwd=repo, slug="auth"))

    assert overview.repository.name == "repo"
    assert overview.featured_page is not None
    assert overview.featured_page.slug == "README"
    assert "auth-flow" in [page.slug for page in overview.pages]
    assert [page.slug for page in search.pages] == ["auth-flow"]
    assert [page.slug for page in topic.pages] == ["auth-flow", "session-store"]


def test_viewer_overview_lists_available_registered_wikis(
    viewer_repo: tuple[Path, CodeAlmanac],
    tmp_path: Path,
):
    repo, app = viewer_repo
    other_repo = tmp_path / "other"
    other_repo.mkdir()
    other = initialize_repository(app, path=other_repo)
    write_viewer_page(
        other_repo,
        "ops-note.md",
        """---
title: Ops Note
topics: [operations]
---
# Ops Note

Tracks operational decisions.
""",
    )
    missing_repo = tmp_path / "missing"
    missing_repo.mkdir()
    missing = initialize_repository(app, path=missing_repo)
    shutil.rmtree(missing_repo)

    overview = app.viewer.overview(ViewerOverviewRequest(cwd=repo))
    selected = app.viewer.overview(
        ViewerOverviewRequest(cwd=repo, repository_name=other.name)
    )

    assert overview.repository.name == "repo"
    assert [repository.name for repository in overview.repositories] == [
        "repo",
        "other",
    ]
    assert missing.repository_id not in [
        repository.repository_id for repository in overview.repositories
    ]
    assert selected.repository.name == "other"
    assert [repository.name for repository in selected.repositories] == [
        "other",
        "repo",
    ]
    assert "ops-note" in [page.slug for page in selected.pages]


def test_viewer_overview_can_be_narrowed_to_one_wiki(
    viewer_repo: tuple[Path, CodeAlmanac],
    tmp_path: Path,
):
    repo, app = viewer_repo
    other_repo = tmp_path / "other"
    other_repo.mkdir()
    other = initialize_repository(app, path=other_repo)

    overview = app.viewer.overview(
        ViewerOverviewRequest(
            cwd=repo,
            repository_name=other.name,
            include_repositories=False,
        )
    )

    assert overview.repository.repository_id == other.repository_id
    assert [repository.repository_id for repository in overview.repositories] == [
        other.repository_id
    ]


def test_viewer_page_renders_markdown_and_reader_relationships(
    viewer_repo: tuple[Path, CodeAlmanac],
):
    repo, app = viewer_repo

    page = app.viewer.page(ViewerPageRequest(cwd=repo, slug="auth-flow"))

    assert page.title == "Auth Flow"
    assert page.outgoing_links == ("session-store",)
    assert page.related_pages[0].slug == "session-store"
    assert [ref.path for ref in page.file_refs] == ["src/auth/session.py"]
    assert [(source.source_id, source.source_type) for source in page.sources] == [
        ("session-file", "file"),
        ("provider-docs", "web"),
    ]
    assert page.sources[0].target == "src/auth/session.py"
    assert page.sources[1].target == "https://example.com/provider"
    assert '<a href="#/page/session-store">Session Store</a>' in page.html
    assert "<code>src/auth/session.py</code>" in page.html
    assert "<code>[Session Store](session-store)</code>" in page.html
    assert "<script>" not in page.html
    assert "&lt;script&gt;alert(1)&lt;/script&gt;" in page.html


def test_viewer_page_reports_backlinks(
    viewer_repo: tuple[Path, CodeAlmanac],
):
    repo, app = viewer_repo

    page = app.viewer.page(ViewerPageRequest(cwd=repo, slug="session-store"))

    assert page.backlinks == ("auth-flow",)
    assert page.related_pages[0].slug == "auth-flow"


def test_viewer_file_lists_pages_that_mention_file_and_folder_refs(
    viewer_repo: tuple[Path, CodeAlmanac],
):
    repo, app = viewer_repo

    file_result = app.viewer.file(
        ViewerFileRequest(cwd=repo, path="src/auth/session.py")
    )
    folder_result = app.viewer.file(ViewerFileRequest(cwd=repo, path="src/auth/"))

    assert file_result.path == "src/auth/session.py"
    assert file_result.kind == "file"
    assert [page.slug for page in file_result.pages] == ["auth-flow"]
    assert folder_result.path == "src/auth/"
    assert folder_result.kind == "directory"
    assert [page.slug for page in folder_result.pages] == ["auth-flow"]


def test_viewer_file_request_rejects_paths_outside_reference_space(
    viewer_repo: tuple[Path, CodeAlmanac],
):
    repo, _ = viewer_repo

    with pytest.raises(ValidationError, match="file path must be repo-relative"):
        ViewerFileRequest(cwd=repo, path="../secret.txt")


def test_viewer_jobs_expose_runs_and_normalized_harness_events(
    viewer_repo: tuple[Path, CodeAlmanac],
):
    repo, app = viewer_repo
    record = create_viewer_run(repo, app)

    jobs = app.viewer.jobs(ViewerJobsRequest(cwd=repo))
    detail = app.viewer.job(ViewerJobRequest(cwd=repo, run_id=record.run_id))

    assert jobs.repository.name == "repo"
    assert [run.run_id for run in jobs.runs] == [record.run_id]
    assert jobs.runs[0].kind == "ingest"
    assert jobs.runs[0].status == "done"
    assert jobs.runs[0].harness_transcript is not None
    assert jobs.runs[0].harness_transcript.kind == "codex"
    assert detail.run.run_id == record.run_id
    assert detail.run.summary == "updated auth page"
    assert [event.kind for event in detail.events] == [
        "status",
        "status",
        "output",
        "status",
    ]
    assert detail.events[2].harness_event is not None
    assert detail.events[2].harness_event.kind == HarnessEventKind.TEXT
    assert detail.events[2].harness_event.message == "Edited auth-flow.md"


def test_viewer_job_request_rejects_path_shaped_run_ids(
    viewer_repo: tuple[Path, CodeAlmanac],
):
    repo, _ = viewer_repo

    with pytest.raises(ValidationError, match="String should match pattern"):
        ViewerJobRequest(cwd=repo, run_id="../secret")


def write_viewer_page(repo: Path, name: str, body: str) -> None:
    path = repo / "almanac" / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(body, encoding="utf-8")


def create_viewer_run(repo: Path, app: CodeAlmanac):
    repository = app.repositories.registered_repository_at(repo)
    record = app.runs.start(
        StartRunRequest(
            repository_id=repository.repository_id,
            kind=RunKind.INGEST,
            title="Digest auth session",
        )
    )
    app.runs.mark_running(MarkRunRunningRequest(run_id=record.run_id))
    app.runs.record_event(
        RecordRunEventRequest(
            run_id=record.run_id,
            kind=RunEventKind.OUTPUT,
            message="Edited auth-flow.md",
            harness_event=HarnessEvent(
                kind=HarnessEventKind.TEXT,
                message="Edited auth-flow.md",
            ),
        )
    )
    app.runs.record_harness_transcript(
        RecordRunHarnessTranscriptRequest(
            run_id=record.run_id,
            transcript=HarnessTranscriptRef(
                kind=HarnessKind.CODEX,
                session_id="codex-session-1",
                transcript_path=repo / "codex-session.jsonl",
            ),
        )
    )
    return app.runs.finish(
        FinishRunRequest(
            run_id=record.run_id,
            status=RunStatus.DONE,
            summary="updated auth page",
        )
    )
