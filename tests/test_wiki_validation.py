from pathlib import Path

import pytest

from codealmanac.app import create_app
from codealmanac.core.errors import ValidationFailed
from codealmanac.core.models import AppConfig
from codealmanac.wiki.validation.models import WikiValidationIssueKind
from codealmanac.wiki.validation.requests import ValidateWikiRequest
from codealmanac.wiki.workspaces.requests import InitializeWorkspaceRequest


def test_validate_wiki_accepts_valid_initialized_wiki(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    app = create_app(
        AppConfig(registry_path=isolated_home / ".codealmanac/registry.json")
    )
    app.workflows.init.initialize_workspace(InitializeWorkspaceRequest(path=repo))

    report = app.validation.check(ValidateWikiRequest(cwd=repo))

    assert report.ok is True
    assert report.pages_checked == 1
    assert report.issues == ()


def test_validate_wiki_reports_invalid_page_frontmatter(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    app = create_app(
        AppConfig(registry_path=isolated_home / ".codealmanac/registry.json")
    )
    app.workflows.init.initialize_workspace(InitializeWorkspaceRequest(path=repo))
    page = repo / "almanac/pages/bad.md"
    page.write_text(
        """---
title: Bad Page
sources:
  - id: bad
    type: file
    path: src/app.py
    note: Records the boundary: bad YAML.
---
# Bad Page
""",
        encoding="utf-8",
    )

    report = app.validation.check(ValidateWikiRequest(cwd=repo))

    assert report.ok is False
    assert len(report.issues) == 1
    assert report.issues[0].kind is WikiValidationIssueKind.FRONTMATTER
    assert report.issues[0].path == Path("almanac/pages/bad.md")
    assert report.issues[0].line == 7
    assert "mapping values" in report.issues[0].message
    with pytest.raises(ValidationFailed, match="wiki validation failed"):
        app.validation.require_valid(report)


def test_validate_wiki_reports_invalid_topics_yaml(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    app = create_app(
        AppConfig(registry_path=isolated_home / ".codealmanac/registry.json")
    )
    app.workflows.init.initialize_workspace(InitializeWorkspaceRequest(path=repo))
    (repo / "almanac/topics.yaml").write_text(
        "topics: [bad: yaml: value]\n",
        encoding="utf-8",
    )

    report = app.validation.check(ValidateWikiRequest(cwd=repo))

    assert report.ok is False
    assert report.issues[0].kind is WikiValidationIssueKind.TOPICS
    assert report.issues[0].path == Path("almanac/topics.yaml")
