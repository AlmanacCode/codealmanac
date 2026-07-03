import sqlite3
from pathlib import Path

import pytest

from codealmanac.app import create_app
from codealmanac.core.errors import NotFoundError
from codealmanac.core.models import AppConfig
from codealmanac.wiki.index.requests import ReindexRequest
from codealmanac.wiki.pages.requests import ShowPageRequest
from codealmanac.wiki.search.requests import SearchPagesRequest
from codealmanac.wiki.workspaces.requests import (
    InitializeWorkspaceRequest,
    RegisterWorkspaceRequest,
)


def test_search_indexes_pages_topics_mentions_and_links(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    app = create_app(
        AppConfig(registry_path=isolated_home / ".codealmanac/registry.json")
    )
    app.workflows.init.initialize_workspace(InitializeWorkspaceRequest(path=repo))
    write_page(
        repo,
        "auth-flow.md",
        """---
title: Auth Flow
summary: How sign-in moves through the app.
topics: [auth]
files:
  - src/auth/
---
# Auth Flow

Login checks [[src/auth/session.py]] and links to [[session-store]].
""",
    )
    write_page(
        repo,
        "session-store.md",
        """---
title: Session Store
topics: [auth]
---
# Session Store

Session persistence details.
""",
    )

    rows = app.search.search(
        SearchPagesRequest(cwd=repo, query="login", topics=("auth",))
    )
    mentioned = app.search.search(
        SearchPagesRequest(cwd=repo, mentions="src/auth/session.py")
    )
    page = app.pages.show(ShowPageRequest(cwd=repo, slug="session-store"))

    assert [row.slug for row in rows] == ["auth-flow"]
    assert [row.slug for row in mentioned] == ["auth-flow"]
    assert page.wikilinks_in == ("auth-flow",)


def test_read_model_projects_structured_page_sources(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    app = create_app(
        AppConfig(registry_path=isolated_home / ".codealmanac/registry.json")
    )
    app.workflows.init.initialize_workspace(InitializeWorkspaceRequest(path=repo))
    write_page(
        repo,
        "source-backed.md",
        """---
title: Source Backed
topics: [evidence]
sources:
  - id: service
    type: file
    path: src/auth/service.py
    note: Defines the authentication service.
  - id: provider-docs
    type: web
    url: https://example.com/provider
    title: Provider docs
    retrieved_at: 2026-07-01
    note: Documents provider behavior.
---
# Source Backed

The auth service checks provider behavior. [@service] [@provider-docs]
""",
    )

    mentioned = app.search.search(
        SearchPagesRequest(cwd=repo, mentions="src/auth/service.py")
    )
    page = app.pages.show(ShowPageRequest(cwd=repo, slug="source-backed"))

    assert [row.slug for row in mentioned] == ["source-backed"]
    assert [source.source_id for source in page.sources] == [
        "service",
        "provider-docs",
    ]
    assert page.sources[0].source_type == "file"
    assert page.sources[0].target == "src/auth/service.py"
    assert page.sources[1].source_type == "web"
    assert page.sources[1].title == "Provider docs"
    assert page.sources[1].retrieved_at == "2026-07-01"
    assert [ref.path for ref in page.file_refs] == ["src/auth/service.py"]


def test_read_model_projects_generic_source_targets(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    app = create_app(
        AppConfig(registry_path=isolated_home / ".codealmanac/registry.json")
    )
    app.workflows.init.initialize_workspace(InitializeWorkspaceRequest(path=repo))
    write_page(
        repo,
        "target-backed.md",
        """---
title: Target Backed
topics: [evidence]
sources:
  - id: service
    type: file
    target: src/auth/service.py
    note: Defines the authentication service.
---
# Target Backed

The auth service is evidence-backed. [@service]
""",
    )

    mentioned = app.search.search(
        SearchPagesRequest(cwd=repo, mentions="src/auth/service.py")
    )
    page = app.pages.show(ShowPageRequest(cwd=repo, slug="target-backed"))

    assert [row.slug for row in mentioned] == ["target-backed"]
    assert page.sources[0].target == "src/auth/service.py"
    assert [ref.path for ref in page.file_refs] == ["src/auth/service.py"]


def test_search_auto_registers_existing_wiki(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    (repo / "almanac/pages").mkdir(parents=True)
    (repo / "almanac/topics.yaml").write_text("topics: []\n", encoding="utf-8")
    write_page(repo, "note.md", "# Note\n\nUniqueNeedle context.\n")
    app = create_app(
        AppConfig(registry_path=isolated_home / ".codealmanac/registry.json")
    )

    rows = app.search.search(SearchPagesRequest(cwd=repo, query="uniqueneedle"))

    assert [row.slug for row in rows] == ["note"]
    assert app.workspaces.list()[0].root_path == repo


def test_search_does_not_materialize_missing_registered_wiki(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    app = create_app(
        AppConfig(registry_path=isolated_home / ".codealmanac/registry.json")
    )
    app.workspaces.register(RegisterWorkspaceRequest(root_path=repo, name="repo"))

    with pytest.raises(NotFoundError):
        app.search.search(SearchPagesRequest(cwd=repo, query="anything"))

    assert not (repo / "almanac").exists()


def test_search_rebuilds_stale_existing_index_schema(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    app = create_app(
        AppConfig(registry_path=isolated_home / ".codealmanac/registry.json")
    )
    app.workflows.init.initialize_workspace(InitializeWorkspaceRequest(path=repo))
    write_page(repo, "note.md", "# Note\n\nStaleSchemaNeedle context.\n")
    db_path = repo / "almanac/index.db"
    with sqlite3.connect(db_path) as connection:
        connection.execute("CREATE TABLE pages (slug TEXT PRIMARY KEY)")
        connection.execute("PRAGMA user_version = 1")

    rows = app.search.search(SearchPagesRequest(cwd=repo, query="staleschemaneedle"))

    assert [row.slug for row in rows] == ["note"]


def test_rebuild_removes_stale_topic_rows(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    app = create_app(
        AppConfig(registry_path=isolated_home / ".codealmanac/registry.json")
    )
    app.workflows.init.initialize_workspace(InitializeWorkspaceRequest(path=repo))
    page_path = repo / "almanac/pages/note.md"
    page_path.write_text("---\ntopics: [old]\n---\n# Note\n", encoding="utf-8")
    app.search.search(SearchPagesRequest(cwd=repo, query="note"))
    page_path.write_text("---\ntopics: [new]\n---\n# Note\n", encoding="utf-8")

    app.search.search(SearchPagesRequest(cwd=repo, query="note"))

    with sqlite3.connect(repo / "almanac/index.db") as connection:
        rows = connection.execute("SELECT slug FROM topics ORDER BY slug").fetchall()
    topic_slugs = {row[0] for row in rows}
    assert "new" in topic_slugs
    assert "old" not in topic_slugs


def test_ensure_fresh_skips_unchanged_projection_and_refreshes_edits(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    app = create_app(
        AppConfig(registry_path=isolated_home / ".codealmanac/registry.json")
    )
    workspace = app.workflows.init.initialize_workspace(
        InitializeWorkspaceRequest(path=repo)
    )
    write_page(repo, "note.md", "# Note\n\nOriginalNeedle.\n")

    first = app.index.ensure_fresh(workspace.workspace_id)
    with sqlite3.connect(repo / "almanac/index.db") as connection:
        connection.execute("CREATE TABLE rewrite_log (slug TEXT NOT NULL)")
        connection.execute(
            """
            CREATE TRIGGER log_page_rewrite
            AFTER DELETE ON pages
            BEGIN
              INSERT INTO rewrite_log (slug) VALUES (old.slug);
            END
            """
        )
    unchanged = app.index.ensure_fresh(workspace.workspace_id)
    with sqlite3.connect(repo / "almanac/index.db") as connection:
        rewrites = connection.execute("SELECT COUNT(*) FROM rewrite_log").fetchone()[0]
    write_page(repo, "note.md", "# Note\n\nChangedNeedle.\n")
    refreshed = app.index.ensure_fresh(workspace.workspace_id)
    with sqlite3.connect(repo / "almanac/index.db") as connection:
        refreshed_rewrites = connection.execute(
            "SELECT COUNT(*) FROM rewrite_log"
        ).fetchone()[0]
    rows = app.search.search(SearchPagesRequest(cwd=repo, query="changedneedle"))

    assert first.changed == 2
    assert unchanged.changed == 0
    assert rewrites == 0
    assert refreshed.changed == 2
    assert refreshed_rewrites == 2
    assert [row.slug for row in rows] == ["note"]


def test_reindex_forces_projection_rebuild_when_index_is_fresh(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    app = create_app(
        AppConfig(registry_path=isolated_home / ".codealmanac/registry.json")
    )
    app.workflows.init.initialize_workspace(InitializeWorkspaceRequest(path=repo))
    write_page(repo, "note.md", "# Note\n\nForceNeedle.\n")
    app.search.search(SearchPagesRequest(cwd=repo, query="forceneedle"))

    result = app.index.reindex(ReindexRequest(cwd=repo))

    assert result.changed == 2
    assert result.pages_indexed == 2


def write_page(repo: Path, name: str, body: str) -> None:
    path = repo / "almanac/pages" / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(body, encoding="utf-8")
