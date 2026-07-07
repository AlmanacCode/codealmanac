import sqlite3
from pathlib import Path

import pytest
from conftest import initialize_repository, runtime_index_path

from codealmanac.app import create_app
from codealmanac.core.errors import NotFoundError, ValidationFailed
from codealmanac.services.index.requests import ReindexRequest
from codealmanac.services.pages.requests import ShowPageRequest
from codealmanac.services.repositories.requests import (
    RegisterRepositoryRequest,
)
from codealmanac.services.search.requests import SearchPagesRequest
from codealmanac.settings import AppConfig


def test_search_indexes_pages_topics_mentions_and_links(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    app = create_app(
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db")
    )
    initialize_repository(app, path=repo)
    write_page(
        repo,
        "auth-flow.md",
        """---
title: Auth Flow
summary: How sign-in moves through the app.
topics: [auth]
sources:
  - id: auth-directory
    type: file
    path: src/auth/
    note: Authentication package.
---
# Auth Flow

Login checks session state and links to [Session Store](session-store).
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
    assert page.page_links_in == ("auth-flow",)


def test_legacy_files_frontmatter_does_not_create_file_refs(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    app = create_app(
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db")
    )
    initialize_repository(app, path=repo)
    legacy_key = "fil" "es"
    write_page(
        repo,
        "legacy-files.md",
        f"""---
title: Legacy Files
topics: [legacy]
{legacy_key}:
  - src/auth/
---
# Legacy Files

This page uses retired file-list frontmatter.
""",
    )

    mentioned = app.search.search(
        SearchPagesRequest(cwd=repo, mentions="src/auth/session.py")
    )
    page = app.pages.show(ShowPageRequest(cwd=repo, slug="legacy-files"))

    assert mentioned == ()
    assert page.file_refs == ()


def test_read_model_projects_structured_page_sources(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    app = create_app(
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db")
    )
    initialize_repository(app, path=repo)
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
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db")
    )
    initialize_repository(app, path=repo)
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
    (repo / "almanac").mkdir(parents=True)
    (repo / "almanac/README.md").write_text(
        "---\ntopics: [concepts]\n---\n# Wiki\n\nRoot page.\n",
        encoding="utf-8",
    )
    (repo / "almanac/topics.yaml").write_text("topics: []\n", encoding="utf-8")
    write_page(repo, "note.md", "# Note\n\nUniqueNeedle context.\n")
    app = create_app(
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db")
    )

    rows = app.search.search(SearchPagesRequest(cwd=repo, query="uniqueneedle"))

    assert [row.slug for row in rows] == ["note"]
    assert app.repositories.list()[0].root_path == repo


def test_nested_page_ids_are_paths_under_almanac(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    app = create_app(
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db")
    )
    initialize_repository(app, path=repo)
    write_page(
        repo,
        "architecture/viewer/navigation/sidebar.md",
        "# Sidebar\n\nNestedNeedle.\n",
    )

    rows = app.search.search(SearchPagesRequest(cwd=repo, query="nestedneedle"))
    page = app.pages.show(
        ShowPageRequest(cwd=repo, slug="architecture/viewer/navigation/sidebar")
    )

    assert [row.slug for row in rows] == ["architecture/viewer/navigation/sidebar"]
    assert page.slug == "architecture/viewer/navigation/sidebar"
    assert page.file_path == repo / "almanac/architecture/viewer/navigation/sidebar.md"


def test_readme_pages_map_to_folder_routes(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    app = create_app(
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db")
    )
    initialize_repository(app, path=repo)
    (repo / "almanac/architecture").mkdir()
    (repo / "almanac/architecture/README.md").write_text(
        "# Architecture\n\nFolderNeedle.\n",
        encoding="utf-8",
    )

    rows = app.search.search(SearchPagesRequest(cwd=repo, query="folderneedle"))
    root = app.pages.show(ShowPageRequest(cwd=repo, slug="README"))
    folder = app.pages.show(ShowPageRequest(cwd=repo, slug="architecture"))

    assert root.slug == "README"
    assert [row.slug for row in rows] == ["architecture"]
    assert folder.file_path == repo / "almanac/architecture/README.md"


def test_readme_route_collision_fails_refresh(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    app = create_app(
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db")
    )
    repository = initialize_repository(app, path=repo)
    write_page(repo, "architecture.md", "# Architecture\n")
    write_page(repo, "architecture/README.md", "# Architecture Folder\n")

    with pytest.raises(ValidationFailed, match="page route collision"):
        app.index.ensure_fresh(repository.repository_id)


def test_search_does_not_materialize_missing_registered_wiki(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    app = create_app(
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db")
    )
    app.repositories.register(RegisterRepositoryRequest(root_path=repo, name="repo"))

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
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db")
    )
    repository = initialize_repository(app, path=repo)
    write_page(repo, "note.md", "# Note\n\nStaleSchemaNeedle context.\n")
    db_path = runtime_index_path(isolated_home, repository)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    db_path.unlink(missing_ok=True)
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
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db")
    )
    repository = initialize_repository(app, path=repo)
    page_path = repo / "almanac/note.md"
    page_path.write_text("---\ntopics: [old]\n---\n# Note\n", encoding="utf-8")
    app.search.search(SearchPagesRequest(cwd=repo, query="note"))
    page_path.write_text("---\ntopics: [new]\n---\n# Note\n", encoding="utf-8")

    app.search.search(SearchPagesRequest(cwd=repo, query="note"))

    with sqlite3.connect(runtime_index_path(isolated_home, repository)) as connection:
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
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db")
    )
    repository = initialize_repository(app, path=repo)
    write_page(repo, "note.md", "# Note\n\nOriginalNeedle.\n")

    first = app.index.ensure_fresh(repository.repository_id)
    db_path = runtime_index_path(isolated_home, repository)
    with sqlite3.connect(db_path) as connection:
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
    unchanged = app.index.ensure_fresh(repository.repository_id)
    with sqlite3.connect(db_path) as connection:
        rewrites = connection.execute("SELECT COUNT(*) FROM rewrite_log").fetchone()[0]
    write_page(repo, "note.md", "# Note\n\nChangedNeedle.\n")
    refreshed = app.index.ensure_fresh(repository.repository_id)
    with sqlite3.connect(db_path) as connection:
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
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db")
    )
    initialize_repository(app, path=repo)
    write_page(repo, "note.md", "# Note\n\nForceNeedle.\n")
    app.search.search(SearchPagesRequest(cwd=repo, query="forceneedle"))

    result = app.index.reindex(ReindexRequest(cwd=repo))

    assert result.changed == 2
    assert result.pages_indexed == 2


def write_page(repo: Path, name: str, body: str) -> None:
    path = repo / "almanac" / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(body, encoding="utf-8")
