from pathlib import Path

from codealmanac.app import create_app
from codealmanac.core.models import AppConfig
from codealmanac.services.workspaces.requests import (
    InitializeWorkspaceRequest,
    SelectWorkspaceRequest,
)


def test_initialize_creates_almanac_wiki_and_registry(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "Example Repo"
    repo.mkdir()
    app = create_app(AppConfig(registry_path=isolated_home / ".almanac/registry.json"))

    workspace = app.workflows.build.initialize(
        InitializeWorkspaceRequest(path=repo, description="test wiki")
    )

    assert workspace.name == "example-repo"
    assert (repo / ".almanac/README.md").is_file()
    assert (repo / ".almanac/topics.yaml").is_file()
    assert (repo / ".almanac/pages/getting-started.md").is_file()
    assert (repo / ".almanac/manual/README.md").is_file()
    assert (repo / ".almanac/manual/ingest.md").is_file()
    gitignore_lines = (repo / ".gitignore").read_text(encoding="utf-8").splitlines()
    assert gitignore_lines.count(".almanac/index.db") == 1
    assert app.workspaces.list()[0].description == "test wiki"


def test_initialize_is_idempotent_and_preserves_existing_pages(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    app = create_app(AppConfig(registry_path=isolated_home / ".almanac/registry.json"))
    app.workflows.build.initialize(InitializeWorkspaceRequest(path=repo, name="repo"))
    readme = repo / ".almanac/README.md"
    readme.write_text("user edit\n", encoding="utf-8")
    manual_readme = repo / ".almanac/manual/README.md"
    manual_readme.write_text("local manual edit\n", encoding="utf-8")

    workspace = app.workflows.build.initialize(
        InitializeWorkspaceRequest(path=repo / "src", name="renamed")
    )

    assert workspace.root_path == repo
    assert workspace.name == "renamed"
    assert readme.read_text(encoding="utf-8") == "user edit\n"
    assert manual_readme.read_text(encoding="utf-8") == "local manual edit\n"


def test_build_refreshes_wiki_and_rebuilds_index(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    app = create_app(AppConfig(registry_path=isolated_home / ".almanac/registry.json"))

    result = app.workflows.build.build(
        InitializeWorkspaceRequest(path=repo, name="repo")
    )

    assert result.workspace.name == "repo"
    assert result.index.pages_indexed == 1
    assert result.index.files_seen == 1
    assert (repo / ".almanac/index.db").is_file()


def test_workspace_selection_supports_name_id_and_path(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    app = create_app(AppConfig(registry_path=isolated_home / ".almanac/registry.json"))
    workspace = app.workflows.build.initialize(InitializeWorkspaceRequest(path=repo))

    by_name = app.workspaces.select(SelectWorkspaceRequest(selector="repo"))

    assert by_name.workspace_id == workspace.workspace_id
