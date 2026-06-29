from pathlib import Path

import pytest
from pydantic import ValidationError

from codealmanac.app import CodeAlmanac
from codealmanac.services.viewer.requests import (
    ViewerFileRequest,
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

    assert overview.workspace.name == "repo"
    assert overview.featured_page is not None
    assert overview.featured_page.slug == "getting-started"
    assert "auth-flow" in [page.slug for page in overview.pages]
    assert [page.slug for page in search.pages] == ["auth-flow"]
    assert [page.slug for page in topic.pages] == ["auth-flow", "session-store"]


def test_viewer_page_renders_markdown_and_reader_relationships(
    viewer_repo: tuple[Path, CodeAlmanac],
):
    repo, app = viewer_repo

    page = app.viewer.page(ViewerPageRequest(cwd=repo, slug="auth-flow"))

    assert page.title == "Auth Flow"
    assert page.outgoing_links == ("session-store",)
    assert page.related_pages[0].slug == "session-store"
    assert [ref.path for ref in page.file_refs] == ["src/auth/session.py"]
    assert '<a href="#/page/session-store">Session Store</a>' in page.html
    assert "<code>src/auth/session.py</code>" in page.html
    assert "<code>[[session-store]]</code>" in page.html
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
