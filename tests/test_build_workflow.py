import shutil
from pathlib import Path

import pytest

from codealmanac.app import create_app
from codealmanac.core.models import AppConfig
from codealmanac.services.workspaces.models import WorkspaceRegistryStatus
from codealmanac.services.workspaces.requests import (
    DropWorkspaceRequest,
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
    assert (repo / "almanac/README.md").is_file()
    assert (repo / "almanac/topics.yaml").is_file()
    assert (repo / "almanac/pages/getting-started.md").is_file()
    assert (repo / "almanac/manual/README.md").is_file()
    assert (repo / "almanac/manual/ingest.md").is_file()
    gitignore_lines = (repo / ".gitignore").read_text(encoding="utf-8").splitlines()
    assert gitignore_lines.count("almanac/index.db") == 1
    assert app.workspaces.list()[0].description == "test wiki"


def test_initialize_supports_configured_almanac_root(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    app = create_app(AppConfig(registry_path=isolated_home / ".almanac/registry.json"))

    workspace = app.workflows.build.initialize(
        InitializeWorkspaceRequest(
            path=repo,
            almanac_root=Path("docs/almanac"),
            name="repo",
        )
    )

    assert workspace.almanac_root == Path("docs/almanac")
    assert workspace.almanac_path == repo / "docs/almanac"
    assert (repo / "docs/almanac/pages/getting-started.md").is_file()
    gitignore_lines = (repo / ".gitignore").read_text(encoding="utf-8").splitlines()
    assert "docs/almanac/index.db" in gitignore_lines
    assert app.workspaces.resolve(repo / "src").almanac_path == repo / "docs/almanac"


def test_build_without_root_preserves_registered_almanac_root(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    app = create_app(AppConfig(registry_path=isolated_home / ".almanac/registry.json"))
    app.workflows.build.initialize(
        InitializeWorkspaceRequest(
            path=repo,
            almanac_root=Path("docs/almanac"),
            name="docs-root",
            description="configured docs root",
        )
    )

    result = app.workflows.build.build(InitializeWorkspaceRequest(path=repo / "src"))

    assert result.workspace.name == "docs-root"
    assert result.workspace.description == "configured docs root"
    assert result.workspace.almanac_root == Path("docs/almanac")
    assert result.workspace.almanac_path == repo / "docs/almanac"
    assert not (repo / "almanac").exists()


def test_initialize_allows_explicit_dot_almanac_root(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    app = create_app(AppConfig(registry_path=isolated_home / ".almanac/registry.json"))

    workspace = app.workflows.build.initialize(
        InitializeWorkspaceRequest(
            path=repo,
            almanac_root=Path(".almanac"),
            name="repo",
        )
    )

    assert workspace.almanac_root == Path(".almanac")
    assert (repo / ".almanac/pages/getting-started.md").is_file()
    assert app.workspaces.resolve(repo).almanac_path == repo / ".almanac"


@pytest.mark.parametrize("root", [Path("/tmp/almanac"), Path("../almanac")])
def test_initialize_rejects_roots_outside_repo(
    tmp_path: Path,
    isolated_home: Path,
    root: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    app = create_app(AppConfig(registry_path=isolated_home / ".almanac/registry.json"))

    with pytest.raises(ValueError):
        app.workflows.build.initialize(
            InitializeWorkspaceRequest(
                path=repo,
                almanac_root=root,
                name="repo",
            )
        )


def test_initialize_is_idempotent_and_preserves_existing_pages(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    app = create_app(AppConfig(registry_path=isolated_home / ".almanac/registry.json"))
    app.workflows.build.initialize(InitializeWorkspaceRequest(path=repo, name="repo"))
    readme = repo / "almanac/README.md"
    readme.write_text("user edit\n", encoding="utf-8")
    manual_readme = repo / "almanac/manual/README.md"
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
    assert (repo / "almanac/index.db").is_file()


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


def test_workspace_registry_reports_and_drops_missing_wikis(
    tmp_path: Path,
    isolated_home: Path,
):
    live_repo = tmp_path / "live"
    live_repo.mkdir()
    missing_repo = tmp_path / "missing"
    missing_repo.mkdir()
    missing_almanac = tmp_path / "missing-almanac"
    missing_almanac.mkdir()
    app = create_app(AppConfig(registry_path=isolated_home / ".almanac/registry.json"))
    app.workflows.build.initialize(
        InitializeWorkspaceRequest(path=live_repo, name="live")
    )
    app.workflows.build.initialize(
        InitializeWorkspaceRequest(path=missing_repo, name="missing")
    )
    app.workflows.build.initialize(
        InitializeWorkspaceRequest(path=missing_almanac, name="missing-almanac")
    )
    remove_tree(missing_repo)
    remove_tree(missing_almanac / "almanac")

    before = app.workspaces.list_registry()
    statuses = {item.workspace.name: item.status for item in before.items}
    result = app.workspaces.drop_missing()

    assert statuses == {
        "live": WorkspaceRegistryStatus.AVAILABLE,
        "missing": WorkspaceRegistryStatus.MISSING_REPO,
        "missing-almanac": WorkspaceRegistryStatus.MISSING_ALMANAC,
    }
    assert tuple(workspace.name for workspace in result.dropped) == (
        "missing",
        "missing-almanac",
    )
    remaining = tuple(
        item.workspace.name for item in app.workspaces.list_registry().items
    )
    assert remaining == ("live",)


def test_workspace_registry_drops_selected_wiki(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    app = create_app(AppConfig(registry_path=isolated_home / ".almanac/registry.json"))
    app.workflows.build.initialize(InitializeWorkspaceRequest(path=repo, name="repo"))

    result = app.workspaces.drop(DropWorkspaceRequest(selector="repo"))

    assert tuple(workspace.name for workspace in result.dropped) == ("repo",)
    assert app.workspaces.list_registry().items == ()


def remove_tree(path: Path) -> None:
    shutil.rmtree(path)
