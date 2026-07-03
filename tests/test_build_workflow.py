import shutil
from pathlib import Path

import pytest

from codealmanac.app import create_app
from codealmanac.core.errors import NotFoundError
from codealmanac.core.models import AppConfig
from codealmanac.wiki.health.requests import HealthCheckRequest
from codealmanac.wiki.workspaces.models import WorkspaceRegistryStatus
from codealmanac.wiki.workspaces.requests import (
    DropWorkspaceRequest,
    InitializeWorkspaceRequest,
    RegisterWorkspaceRequest,
    SelectWorkspaceRequest,
)
from codealmanac.wiki.workspaces.roots import is_initialized_almanac_root


def test_initialize_creates_almanac_wiki_and_registry(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "Example Repo"
    repo.mkdir()
    app = create_app(
        AppConfig(registry_path=isolated_home / ".codealmanac/registry.json")
    )

    workspace = app.workflows.init.initialize_workspace(
        InitializeWorkspaceRequest(path=repo, description="test wiki")
    )

    assert workspace.name == "example-repo"
    assert (repo / "almanac/README.md").is_file()
    assert (repo / "almanac/topics.yaml").is_file()
    assert (repo / "almanac/pages/getting-started.md").is_file()
    assert (repo / "almanac/manual/README.md").is_file()
    assert (repo / "almanac/manual/init.md").is_file()
    assert (repo / "almanac/manual/ingest.md").is_file()
    gitignore_lines = (repo / ".gitignore").read_text(encoding="utf-8").splitlines()
    assert gitignore_lines.count("almanac/index.db") == 1
    assert app.workspaces.list()[0].description == "test wiki"


def test_initialize_starter_wiki_has_no_health_noise(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    app = create_app(
        AppConfig(registry_path=isolated_home / ".codealmanac/registry.json")
    )
    app.workflows.init.initialize_workspace(InitializeWorkspaceRequest(path=repo))

    report = app.health.check(HealthCheckRequest(cwd=repo))

    assert report.empty_topics == ()
    assert report.broken_links == ()
    assert report.dead_refs == ()


def test_initialize_supports_configured_almanac_root(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    app = create_app(
        AppConfig(registry_path=isolated_home / ".codealmanac/registry.json")
    )

    workspace = app.workflows.init.initialize_workspace(
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


def test_initialize_without_root_preserves_registered_almanac_root(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    app = create_app(
        AppConfig(registry_path=isolated_home / ".codealmanac/registry.json")
    )
    app.workflows.init.initialize_workspace(
        InitializeWorkspaceRequest(
            path=repo,
            almanac_root=Path("docs/almanac"),
            name="docs-root",
            description="configured docs root",
        )
    )

    workspace = app.workflows.init.initialize_workspace(
        InitializeWorkspaceRequest(path=repo / "src")
    )

    assert workspace.name == "docs-root"
    assert workspace.description == "configured docs root"
    assert workspace.almanac_root == Path("docs/almanac")
    assert workspace.almanac_path == repo / "docs/almanac"
    assert not (repo / "almanac").exists()


def test_initialize_allows_explicit_dot_almanac_root(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    app = create_app(
        AppConfig(registry_path=isolated_home / ".codealmanac/registry.json")
    )

    workspace = app.workflows.init.initialize_workspace(
        InitializeWorkspaceRequest(
            path=repo,
            almanac_root=Path(".almanac"),
            name="repo",
        )
    )

    assert workspace.almanac_root == Path(".almanac")
    assert (repo / ".almanac/pages/getting-started.md").is_file()
    assert app.workspaces.resolve(repo).almanac_path == repo / ".almanac"


def test_resolve_discovers_unregistered_dot_almanac_root(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    (repo / ".almanac/pages").mkdir(parents=True)
    (repo / ".almanac/topics.yaml").write_text("topics: []\n", encoding="utf-8")
    app = create_app(
        AppConfig(registry_path=isolated_home / ".codealmanac/registry.json")
    )

    workspace = app.workspaces.resolve(repo / "src")

    assert workspace.root_path == repo
    assert workspace.almanac_root == Path(".almanac")
    assert workspace.almanac_path == repo / ".almanac"


def test_resolve_prefers_nearest_initialized_root_over_broad_parent_registry(
    tmp_path: Path,
    isolated_home: Path,
):
    projects = tmp_path / "Projects"
    repo = projects / "codealmanac"
    (repo / ".almanac/pages").mkdir(parents=True)
    (repo / ".almanac/topics.yaml").write_text("topics: []\n", encoding="utf-8")
    app = create_app(
        AppConfig(registry_path=isolated_home / ".codealmanac/registry.json")
    )
    app.workspaces.register(
        RegisterWorkspaceRequest(
            root_path=projects,
            almanac_root=Path("almanac"),
            name="projects",
        )
    )

    workspace = app.workspaces.resolve(repo)

    assert workspace.root_path == repo
    assert workspace.almanac_root == Path(".almanac")
    assert workspace.almanac_path == repo / ".almanac"


def test_initialized_wiki_requires_topics_yaml_and_pages(tmp_path: Path):
    readme_only = tmp_path / "readme-only"
    topics_only = tmp_path / "topics-only"
    pages_only = tmp_path / "pages-only"
    initialized = tmp_path / "initialized"
    readme_only.mkdir()
    topics_only.mkdir()
    (pages_only / "pages").mkdir(parents=True)
    (initialized / "pages").mkdir(parents=True)
    (readme_only / "README.md").write_text("# Not enough\n", encoding="utf-8")
    (topics_only / "topics.yaml").write_text("topics: []\n", encoding="utf-8")
    (initialized / "topics.yaml").write_text("topics: []\n", encoding="utf-8")

    assert is_initialized_almanac_root(readme_only) is False
    assert is_initialized_almanac_root(topics_only) is False
    assert is_initialized_almanac_root(pages_only) is False
    assert is_initialized_almanac_root(initialized) is True


def test_readme_only_almanac_folder_does_not_auto_register_parent(
    tmp_path: Path,
    isolated_home: Path,
):
    projects = tmp_path / "Projects"
    repo = projects / "codealmanac"
    sibling = projects / "almanac"
    repo.mkdir(parents=True)
    sibling.mkdir()
    (sibling / "README.md").write_text("# Separate project\n", encoding="utf-8")
    app = create_app(
        AppConfig(registry_path=isolated_home / ".codealmanac/registry.json")
    )

    with pytest.raises(NotFoundError):
        app.workspaces.resolve(repo)

    assert app.workspaces.list() == []


@pytest.mark.parametrize("root", [Path("/tmp/almanac"), Path("../almanac")])
def test_initialize_rejects_roots_outside_repo(
    tmp_path: Path,
    isolated_home: Path,
    root: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    app = create_app(
        AppConfig(registry_path=isolated_home / ".codealmanac/registry.json")
    )

    with pytest.raises(ValueError):
        app.workflows.init.initialize_workspace(
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
    app = create_app(
        AppConfig(registry_path=isolated_home / ".codealmanac/registry.json")
    )
    app.workflows.init.initialize_workspace(
        InitializeWorkspaceRequest(path=repo, name="repo")
    )
    readme = repo / "almanac/README.md"
    readme.write_text("user edit\n", encoding="utf-8")
    manual_readme = repo / "almanac/manual/README.md"
    manual_readme.write_text("local manual edit\n", encoding="utf-8")

    workspace = app.workflows.init.initialize_workspace(
        InitializeWorkspaceRequest(path=repo / "src", name="renamed")
    )

    assert workspace.root_path == repo
    assert workspace.name == "renamed"
    assert readme.read_text(encoding="utf-8") == "user edit\n"
    assert manual_readme.read_text(encoding="utf-8") == "local manual edit\n"


def test_initialize_workspace_refreshes_wiki_and_rebuilds_index(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    app = create_app(
        AppConfig(registry_path=isolated_home / ".codealmanac/registry.json")
    )

    workspace = app.workflows.init.initialize_workspace(
        InitializeWorkspaceRequest(path=repo, name="repo")
    )
    index = app.index.ensure_fresh(workspace.workspace_id)

    assert workspace.name == "repo"
    assert index.pages_indexed == 1
    assert index.files_seen == 1
    assert (repo / "almanac/index.db").is_file()


def test_workspace_selection_supports_name_id_and_path(
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
    index_only = tmp_path / "index-only"
    index_only.mkdir()
    app = create_app(
        AppConfig(registry_path=isolated_home / ".codealmanac/registry.json")
    )
    app.workflows.init.initialize_workspace(
        InitializeWorkspaceRequest(path=live_repo, name="live")
    )
    app.workflows.init.initialize_workspace(
        InitializeWorkspaceRequest(path=missing_repo, name="missing")
    )
    app.workflows.init.initialize_workspace(
        InitializeWorkspaceRequest(path=missing_almanac, name="missing-almanac")
    )
    app.workspaces.register(
        RegisterWorkspaceRequest(root_path=index_only, name="index-only")
    )
    (index_only / "almanac").mkdir()
    (index_only / "almanac/index.db").write_bytes(b"derived")
    remove_tree(missing_repo)
    remove_tree(missing_almanac / "almanac")

    before = app.workspaces.list_registry()
    statuses = {item.workspace.name: item.status for item in before.items}
    result = app.workspaces.drop_missing()

    assert statuses == {
        "live": WorkspaceRegistryStatus.AVAILABLE,
        "missing": WorkspaceRegistryStatus.MISSING_REPO,
        "missing-almanac": WorkspaceRegistryStatus.MISSING_ALMANAC,
        "index-only": WorkspaceRegistryStatus.MISSING_ALMANAC,
    }
    assert tuple(workspace.name for workspace in result.dropped) == (
        "missing",
        "missing-almanac",
        "index-only",
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
    app = create_app(
        AppConfig(registry_path=isolated_home / ".codealmanac/registry.json")
    )
    app.workflows.init.initialize_workspace(
        InitializeWorkspaceRequest(path=repo, name="repo")
    )

    result = app.workspaces.drop(DropWorkspaceRequest(selector="repo"))

    assert tuple(workspace.name for workspace in result.dropped) == ("repo",)
    assert app.workspaces.list_registry().items == ()


def remove_tree(path: Path) -> None:
    shutil.rmtree(path)
