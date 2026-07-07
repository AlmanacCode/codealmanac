from pathlib import Path

from fastapi.testclient import TestClient

from codealmanac.app import CodeAlmanac
from codealmanac.server.app import create_server_app
from codealmanac.services.harnesses.models import HarnessEvent, HarnessEventKind
from codealmanac.services.repositories.requests import RegisterRepositoryRequest
from codealmanac.services.runs.models import RunEventKind, RunKind, RunStatus
from codealmanac.services.runs.requests import (
    FinishRunRequest,
    MarkRunRunningRequest,
    RecordRunEventRequest,
    StartRunRequest,
)


def test_server_serves_static_assets_and_viewer_api(
    viewer_repo: tuple[Path, CodeAlmanac],
):
    repo, app = viewer_repo
    client = TestClient(create_server_app(app, repo))

    index = client.get("/")
    overview = client.get("/api/overview")
    page = client.get("/api/page/auth-flow")
    search = client.get("/api/search", params={"q": "login"})
    file = client.get("/api/file", params={"path": "src/auth/session.py"})
    topic = client.get("/api/topic/auth")
    javascript = client.get("/app.js")
    module = client.get("/assets/viewer/main.js")
    renderers_module = client.get("/assets/viewer/renderers.js")
    api_module = client.get("/assets/viewer/api.js")
    jobs_module = client.get("/assets/viewer/jobs.js")

    assert index.status_code == 200
    assert "CodeAlmanac" in index.text
    assert "repo-owned wiki" in index.text
    assert "Local knowledge graph" in index.text
    assert 'data-nav-kind="jobs"' in index.text
    assert 'type="module"' in index.text
    assert javascript.status_code == 200
    assert 'import { startViewer } from "/assets/viewer/main.js";' in javascript.text
    assert javascript.headers["content-type"].startswith("text/javascript")
    assert module.status_code == 200
    assert module.headers["content-type"].startswith("text/javascript")
    assert 'from "./renderers.js"' in module.text
    assert "dataset.railKind" in module.text
    assert renderers_module.status_code == 200
    assert "Sources" in renderers_module.text
    assert api_module.status_code == 200
    assert "withQuery" in api_module.text
    assert jobs_module.status_code == 200
    assert "renderJob" in jobs_module.text
    assert "clearJobPolling" in jobs_module.text
    assert "setTimeout" in jobs_module.text
    assert '"queued", "running"' in jobs_module.text
    assert "Transcript" in jobs_module.text
    assert "renderMarkdown" in jobs_module.text
    assert "Intl.DateTimeFormat" in jobs_module.text
    assert "groupByDay" in jobs_module.text
    assert 'replace("T", " ")' not in jobs_module.text
    assert overview.json()["repository"]["name"] == "repo"
    assert overview.json()["repositories"][0]["name"] == "repo"
    assert page.json()["slug"] == "auth-flow"
    assert page.json()["sources"][0]["source_id"] == "session-file"
    assert page.json()["sources"][0]["target"] == "src/auth/session.py"
    assert '<a href="#/page/session-store">Session Store</a>' in page.json()["html"]
    assert [row["slug"] for row in search.json()["pages"]] == ["auth-flow"]
    assert file.json()["kind"] == "file"
    assert [row["slug"] for row in file.json()["pages"]] == ["auth-flow"]
    assert [row["slug"] for row in topic.json()["pages"]] == [
        "auth-flow",
        "session-store",
    ]


def test_server_serves_jobs_api_with_readable_steps(
    viewer_repo: tuple[Path, CodeAlmanac],
):
    repo, app = viewer_repo
    record = create_server_run(repo, app)
    client = TestClient(create_server_app(app, repo))

    jobs = client.get("/api/jobs")
    detail = client.get(f"/api/jobs/{record.run_id}")

    assert jobs.status_code == 200
    assert jobs.json()["repository"]["name"] == "repo"
    assert [run["run_id"] for run in jobs.json()["runs"]] == [record.run_id]
    assert jobs.json()["runs"][0]["status"] == "done"
    assert detail.status_code == 200
    assert detail.json()["run"]["summary"] == "updated wiki"
    assert detail.json()["steps"][2]["kind"] == "assistant"
    assert detail.json()["steps"][2]["body"] == "Created auth-flow.md"


def test_server_viewer_api_switches_between_registered_wikis(
    viewer_repo: tuple[Path, CodeAlmanac],
    tmp_path: Path,
):
    repo, app = viewer_repo
    other_repo = tmp_path / "other"
    other_repo.mkdir()
    other = app.repositories.register(RegisterRepositoryRequest(root_path=other_repo))
    app.wiki.initialize(other.repository_id)
    write_server_page(
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
    client = TestClient(create_server_app(app, repo))

    overview = client.get("/api/overview")
    other_overview = client.get("/api/overview", params={"wiki": other.name})
    other_page = client.get(
        "/api/page/ops-note",
        params={"wiki": other.name},
    )
    locked_client = TestClient(create_server_app(app, repo, other.name))
    locked_overview = locked_client.get("/api/overview")
    locked_page = locked_client.get("/api/page/ops-note")

    assert overview.status_code == 200
    assert [repository["name"] for repository in overview.json()["repositories"]] == [
        "repo",
        "other",
    ]
    assert other_overview.status_code == 200
    assert other_overview.json()["repository"]["repository_id"] == other.repository_id
    assert other_page.status_code == 200
    assert other_page.json()["title"] == "Ops Note"
    assert locked_overview.status_code == 200
    assert locked_overview.json()["repository"]["repository_id"] == other.repository_id
    locked_repository_ids = [
        repository["repository_id"]
        for repository in locked_overview.json()["repositories"]
    ]
    assert locked_repository_ids == [other.repository_id]
    assert locked_page.status_code == 200
    assert locked_page.json()["slug"] == "ops-note"


def test_server_maps_product_errors_to_http_statuses(
    viewer_repo: tuple[Path, CodeAlmanac],
):
    repo, app = viewer_repo
    client = TestClient(create_server_app(app, repo))

    response = client.get("/api/page/missing")

    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "not_found"


def test_server_maps_request_validation_errors_to_http_statuses(
    viewer_repo: tuple[Path, CodeAlmanac],
):
    repo, app = viewer_repo
    client = TestClient(create_server_app(app, repo))

    response = client.get("/api/search", params={"limit": "-1"})

    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "validation_failed"


def test_server_rejects_invalid_file_reference_paths(
    viewer_repo: tuple[Path, CodeAlmanac],
):
    repo, app = viewer_repo
    client = TestClient(create_server_app(app, repo))

    response = client.get("/api/file", params={"path": "../secret.txt"})

    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "validation_failed"


def test_server_rejects_invalid_static_asset_paths(
    viewer_repo: tuple[Path, CodeAlmanac],
):
    repo, app = viewer_repo
    client = TestClient(create_server_app(app, repo))

    traversal = client.get("/assets/%2E%2E/app.js")
    missing = client.get("/assets/viewer/missing.js")
    unsupported = client.get("/assets/viewer/main.txt")

    assert traversal.status_code == 422
    assert traversal.json()["detail"]["code"] == "validation_failed"
    assert missing.status_code == 404
    assert missing.json()["detail"]["code"] == "not_found"
    assert unsupported.status_code == 422
    assert unsupported.json()["detail"]["code"] == "validation_failed"


def test_server_rejects_path_shaped_job_ids(
    viewer_repo: tuple[Path, CodeAlmanac],
):
    repo, app = viewer_repo
    client = TestClient(create_server_app(app, repo))

    response = client.get("/api/jobs/..secret")

    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "validation_failed"


def write_server_page(repo: Path, name: str, body: str) -> None:
    path = repo / "almanac" / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(body, encoding="utf-8")


def create_server_run(repo: Path, app: CodeAlmanac):
    repository = app.repositories.registered_repository_at(repo)
    record = app.runs.start(
        StartRunRequest(
            repository_id=repository.repository_id,
            kind=RunKind.INGEST,
            title="Digest auth note",
        )
    )
    app.runs.mark_running(MarkRunRunningRequest(run_id=record.run_id))
    app.runs.record_event(
        RecordRunEventRequest(
            run_id=record.run_id,
            kind=RunEventKind.OUTPUT,
            message="Created auth-flow.md",
            harness_event=HarnessEvent(
                kind=HarnessEventKind.TEXT,
                message="Created auth-flow.md",
            ),
        )
    )
    return app.runs.finish(
        FinishRunRequest(
            run_id=record.run_id,
            status=RunStatus.DONE,
            summary="updated wiki",
        )
    )
