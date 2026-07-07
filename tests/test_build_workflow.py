import shutil
import subprocess
from pathlib import Path

import pytest
from conftest import initialize_repository, runtime_index_path

from codealmanac.app import create_app
from codealmanac.core.errors import (
    AlreadyExists,
    ExecutionFailed,
    NoRepositorySelected,
    ValidationFailed,
)
from codealmanac.services.harnesses.models import (
    HarnessKind,
    HarnessReadiness,
    HarnessRunResult,
    HarnessRunStatus,
)
from codealmanac.services.harnesses.requests import RunHarnessRequest
from codealmanac.services.health.requests import HealthCheckRequest
from codealmanac.services.repositories.models import RepositoryState
from codealmanac.services.repositories.requests import RegisterRepositoryRequest
from codealmanac.services.repositories.roots import is_initialized_almanac_root
from codealmanac.services.runs.models import RunKind, RunStatus
from codealmanac.settings import AppConfig
from codealmanac.workflows.build.requests import BuildRequest, StartedBuildRequest


class BuildWritingHarnessAdapter:
    kind = HarnessKind.CODEX

    def __init__(self):
        self.requests: list[RunHarnessRequest] = []

    def check(self) -> HarnessReadiness:
        return HarnessReadiness(
            kind=self.kind,
            available=True,
            message="codex ready",
        )

    def run(self, request: RunHarnessRequest) -> HarnessRunResult:
        self.requests.append(request)
        page = request.cwd / "almanac/architecture/build-flow.md"
        page.parent.mkdir(parents=True, exist_ok=True)
        page.write_text(
            """---
title: Build Flow
topics: [getting-started]
sources: []
---
# Build Flow

Build creates the first useful wiki for this repository.
""",
            encoding="utf-8",
        )
        return HarnessRunResult(
            kind=self.kind,
            status=HarnessRunStatus.SUCCEEDED,
            output_text="built wiki",
            summary="built wiki",
            changed_files=(page,),
        )


def test_initialize_creates_almanac_wiki_and_database(
    tmp_path: Path,
    isolated_home: Path,
) -> None:
    repo = tmp_path / "Example Repo"
    repo.mkdir()
    app = create_app(
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db")
    )

    repository = initialize_repository(app, path=repo, description="test wiki")

    assert repository.name == "example-repo"
    assert (repo / "almanac/README.md").is_file()
    assert (repo / "almanac/topics.yaml").is_file()
    assert not (repo / "almanac/manual").exists()
    assert not (repo / ".gitignore").exists()
    assert app.repositories.list()[0].description == "test wiki"


def test_initialize_starter_wiki_has_no_health_noise(
    tmp_path: Path,
    isolated_home: Path,
) -> None:
    repo = tmp_path / "repo"
    repo.mkdir()
    app = create_app(
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db")
    )
    initialize_repository(app, path=repo)

    report = app.health.check(HealthCheckRequest(cwd=repo))

    assert report.empty_topics == ()
    assert report.broken_links == ()
    assert report.dead_refs == ()


def test_initialize_rejects_existing_almanac(
    tmp_path: Path,
    isolated_home: Path,
) -> None:
    repo = tmp_path / "repo"
    repo.mkdir()
    app = create_app(
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db")
    )
    initialize_repository(app, path=repo, name="repo")
    readme = repo / "almanac/README.md"
    readme.write_text("user edit\n", encoding="utf-8")

    with pytest.raises(AlreadyExists):
        app.workflows.queue.queue_build(
            BuildRequest(
                path=repo,
                harness=HarnessKind.CODEX,
                model="gpt-5.5",
                name="renamed",
            )
        )

    assert readme.read_text(encoding="utf-8") == "user edit\n"


def test_initialized_wiki_requires_topics_yaml_and_readme(tmp_path: Path) -> None:
    readme_only = tmp_path / "readme-only"
    topics_only = tmp_path / "topics-only"
    initialized = tmp_path / "initialized"
    readme_only.mkdir()
    topics_only.mkdir()
    initialized.mkdir()
    (readme_only / "README.md").write_text("# Not enough\n", encoding="utf-8")
    (topics_only / "topics.yaml").write_text("topics: []\n", encoding="utf-8")
    (initialized / "README.md").write_text(
        "---\ntopics: [concepts]\n---\n# Wiki\n\nRoot page.\n",
        encoding="utf-8",
    )
    (initialized / "topics.yaml").write_text("topics: []\n", encoding="utf-8")

    assert is_initialized_almanac_root(readme_only) is False
    assert is_initialized_almanac_root(topics_only) is False
    assert is_initialized_almanac_root(initialized) is True


def test_queued_build_uses_harness_prompt_and_records_build_operation(
    tmp_path: Path,
    isolated_home: Path,
) -> None:
    repo = tmp_path / "repo"
    repo.mkdir()
    initialize_git(repo)
    adapter = BuildWritingHarnessAdapter()
    app = create_app(
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db"),
        harness_adapters=(adapter,),
    )
    queued = app.workflows.queue.queue_build(
        BuildRequest(
            path=repo,
            harness=HarnessKind.CODEX,
            model="gpt-5.5",
            name="repo",
            guidance="Write the smallest useful first wiki.",
        )
    )

    result = app.workflows.build.run_started(
        StartedBuildRequest(
            run_id=queued.run_id,
            harness=HarnessKind.CODEX,
            model="gpt-5.5",
            guidance="Write the smallest useful first wiki.",
        )
    )

    assert result.run.kind == RunKind.BUILD
    assert result.run.status == RunStatus.DONE
    assert result.run.summary == "built wiki"
    assert result.index.pages_indexed == 2
    assert runtime_index_path(isolated_home, result.repository).is_file()
    assert result.safety is not None
    assert result.safety.changed_files == (
        repo / "almanac/architecture/build-flow.md",
    )
    assert adapter.requests[0].model == "gpt-5.5"
    assert "Build Operation" in adapter.requests[0].prompt
    assert "Write the smallest useful first wiki." in adapter.requests[0].prompt


class BrokenHarnessAdapter:
    kind = HarnessKind.CODEX

    def __init__(self):
        self.requests: list[RunHarnessRequest] = []

    def check(self) -> HarnessReadiness:
        return HarnessReadiness(
            kind=self.kind,
            available=False,
            message="Error: spawn codex ENOENT",
            repair="reinstall with `npm install -g @openai/codex`",
        )

    def run(self, request: RunHarnessRequest) -> HarnessRunResult:
        self.requests.append(request)
        raise AssertionError("a broken harness never runs")


def test_queue_build_fails_before_queueing_when_harness_is_broken(
    tmp_path: Path,
    isolated_home: Path,
) -> None:
    repo = tmp_path / "repo"
    repo.mkdir()
    initialize_git(repo)
    adapter = BrokenHarnessAdapter()
    app = create_app(
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db"),
        harness_adapters=(adapter,),
    )

    with pytest.raises(ExecutionFailed, match="harness codex is not available"):
        app.workflows.queue.queue_build(
            BuildRequest(
                path=repo,
                harness=HarnessKind.CODEX,
                model="gpt-5.5",
                name="repo",
            )
        )

    assert app.repositories.list() == []
    assert not (repo / "almanac").exists()
    assert adapter.requests == []


def test_run_build_rejects_non_git_repo_without_registering(
    tmp_path: Path,
    isolated_home: Path,
) -> None:
    repo = tmp_path / "repo"
    repo.mkdir()
    adapter = BuildWritingHarnessAdapter()
    app = create_app(
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db"),
        harness_adapters=(adapter,),
    )

    with pytest.raises(ValidationFailed, match="build requires Git change tracking"):
        app.workflows.queue.queue_build(
            BuildRequest(
                path=repo,
                harness=HarnessKind.CODEX,
                model="gpt-5.5",
                name="repo",
            )
        )

    assert app.repositories.list() == []
    assert not (repo / "almanac").exists()
    assert adapter.requests == []


def test_repository_states_report_missing_paths(
    tmp_path: Path,
    isolated_home: Path,
) -> None:
    live_repo = tmp_path / "live"
    live_repo.mkdir()
    missing_repo = tmp_path / "missing"
    missing_repo.mkdir()
    missing_almanac = tmp_path / "missing-almanac"
    missing_almanac.mkdir()
    app = create_app(
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db")
    )
    initialize_repository(app, path=live_repo, name="live")
    initialize_repository(app, path=missing_repo, name="missing")
    initialize_repository(app, path=missing_almanac, name="missing-almanac")
    remove_tree(missing_repo)
    remove_tree(missing_almanac / "almanac")

    states = {
        item.repository.name: item.state
        for item in app.repositories.list_registered().repositories
    }

    assert states == {
        "live": RepositoryState.AVAILABLE,
        "missing": RepositoryState.MISSING_REPO,
        "missing-almanac": RepositoryState.MISSING_ALMANAC,
    }


def test_existing_almanac_can_auto_register_for_read(
    tmp_path: Path,
    isolated_home: Path,
) -> None:
    repo = tmp_path / "repo"
    (repo / "almanac").mkdir(parents=True)
    (repo / "almanac/README.md").write_text(
        "---\ntopics: [concepts]\n---\n# Wiki\n",
        encoding="utf-8",
    )
    (repo / "almanac/topics.yaml").write_text("topics: []\n", encoding="utf-8")
    app = create_app(
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db")
    )

    repository = app.repositories.read_repository_at(repo)

    assert repository.root_path == repo
    assert repository.almanac_path == repo / "almanac"


def test_register_reuses_exact_path_without_root_hopping(
    tmp_path: Path,
    isolated_home: Path,
) -> None:
    parent = tmp_path / "parent"
    child = parent / "child"
    child.mkdir(parents=True)
    app = create_app(
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db")
    )
    app.repositories.register(
        RegisterRepositoryRequest(root_path=parent, name="parent")
    )

    with pytest.raises(NoRepositorySelected):
        app.repositories.registered_repository_at(child)


def remove_tree(path: Path) -> None:
    shutil.rmtree(path)


def initialize_git(repo: Path) -> None:
    subprocess.run(("git", "init"), cwd=repo, check=True, capture_output=True)
