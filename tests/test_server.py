from pathlib import Path

from fastapi.testclient import TestClient

from codealmanac.app import CodeAlmanac
from codealmanac.server.app import create_server_app


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

    assert index.status_code == 200
    assert "CodeAlmanac" in index.text
    assert javascript.status_code == 200
    assert "loadOverview" in javascript.text
    assert overview.json()["workspace"]["name"] == "repo"
    assert page.json()["slug"] == "auth-flow"
    assert '<a href="#/page/session-store">Session Store</a>' in page.json()["html"]
    assert [row["slug"] for row in search.json()["pages"]] == ["auth-flow"]
    assert file.json()["kind"] == "file"
    assert [row["slug"] for row in file.json()["pages"]] == ["auth-flow"]
    assert [row["slug"] for row in topic.json()["pages"]] == [
        "auth-flow",
        "session-store",
    ]
    assert "/api/file?path=" in javascript.text
    assert "renderFile" in javascript.text


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
