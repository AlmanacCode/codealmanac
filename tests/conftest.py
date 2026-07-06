from collections.abc import Iterator
from pathlib import Path

import pytest

from codealmanac.app import CodeAlmanac, create_app
from codealmanac.core.models import AppConfig
from codealmanac.services.workspaces.requests import InitializeWorkspaceRequest


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
        AppConfig(registry_path=isolated_home / ".codealmanac/registry.json")
    )
    app.workflows.build.initialize(InitializeWorkspaceRequest(path=repo))
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
