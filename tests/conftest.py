from collections.abc import Iterator
from datetime import UTC, datetime
from pathlib import Path

import pytest

from codealmanac.app import CodeAlmanac, create_app
from codealmanac.core.paths import normalize_path
from codealmanac.services.repositories.identity import repository_id_for
from codealmanac.services.repositories.models import Repository
from codealmanac.services.repositories.requests import RegisterRepositoryRequest
from codealmanac.services.runs.models import RunExecutionRef
from codealmanac.settings import AppConfig
from codealmanac.workflows.run_queue.executor import RunExecutor
from codealmanac.workflows.run_queue.requests import (
    ExecuteRunRequest,
    SpawnRunExecutorRequest,
)


class FakeRunProcessController:
    def __init__(self, pid: int = 4242):
        self.execution = RunExecutionRef(
            execution_id="test-execution",
            pid=pid,
            process_started_at=datetime(2026, 1, 1, tzinfo=UTC),
        )
        self.terminated: list[RunExecutionRef] = []

    def current_execution(self) -> RunExecutionRef:
        return self.execution

    def terminate(self, execution: RunExecutionRef) -> None:
        self.terminated.append(execution)


class InlineRunExecutorProcess:
    def __init__(self, executor: RunExecutor, run_id: str):
        self.executor = executor
        self.run_id = run_id
        self.pid = 4242

    def wait(self) -> int:
        try:
            self.executor.execute(ExecuteRunRequest(run_id=self.run_id))
        except Exception:
            return 1
        return 0


class InlineRunExecutorSpawner:
    def __init__(self):
        self.executor: RunExecutor | None = None
        self.requests: list[SpawnRunExecutorRequest] = []

    def bind(self, executor: RunExecutor) -> None:
        self.executor = executor

    def spawn(self, request: SpawnRunExecutorRequest) -> InlineRunExecutorProcess:
        if self.executor is None:
            raise RuntimeError("inline executor spawner is not bound")
        self.requests.append(request)
        return InlineRunExecutorProcess(self.executor, request.run_id)


def bind_inline_executor(
    app: CodeAlmanac,
    spawner: InlineRunExecutorSpawner,
) -> None:
    spawner.bind(app.workflows.queue.executor)


@pytest.fixture
def isolated_home(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[Path]:
    home = tmp_path / "home"
    home.mkdir()
    monkeypatch.setenv("HOME", str(home))
    yield home


@pytest.fixture
def viewer_repo(tmp_path: Path, isolated_home: Path) -> tuple[Path, CodeAlmanac]:
    repo = tmp_path / "repo"
    repo.mkdir()
    app = create_app(
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db")
    )
    repository = app.repositories.register(RegisterRepositoryRequest(root_path=repo))
    app.wiki.initialize(repository.repository_id)
    (repo / "src/auth").mkdir(parents=True)
    (repo / "src/auth/session.py").write_text("SESSION = True\n", encoding="utf-8")
    write_page(
        repo,
        "auth-flow.md",
        """---
title: Auth Flow
summary: Login path.
topics: [auth]
sources:
  - id: session-file
    type: file
    path: src/auth/session.py
    note: Defines the session constant.
  - id: provider-docs
    type: web
    url: https://example.com/provider
    title: Provider docs
    note: Documents provider behavior.
---
# Auth Flow

Login checks `src/auth/session.py` and [Session Store](session-store).
[@session-file] [@provider-docs]

Inline code keeps `[Session Store](session-store)` as source text.

<script>alert(1)</script>
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

Stores session facts.
""",
    )
    return repo, app


def write_page(repo: Path, name: str, body: str) -> None:
    path = repo / "almanac" / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(body, encoding="utf-8")


def initialize_repository(
    app: CodeAlmanac,
    path: Path,
    name: str | None = None,
    description: str = "",
) -> Repository:
    repository = app.repositories.register(
        RegisterRepositoryRequest(
            root_path=path,
            name=name,
            description=description,
        )
    )
    app.wiki.initialize(repository.repository_id)
    return repository


def runtime_repo_path(home: Path, repository: Repository) -> Path:
    return home / ".codealmanac" / "repos" / repository.repository_id


def runtime_repo_path_for_root(home: Path, root_path: Path) -> Path:
    repository_id = repository_id_for(normalize_path(root_path))
    return home / ".codealmanac" / "repos" / repository_id


def runtime_index_path(home: Path, repository: Repository) -> Path:
    return runtime_repo_path(home, repository) / "index.db"


def runtime_runs_path(home: Path, repository: Repository) -> Path:
    return runtime_repo_path(home, repository) / "runs"
