from pathlib import Path

from codealmanac.app import create_app
from codealmanac.core.models import AppConfig
from codealmanac.services.health.requests import HealthCheckRequest
from codealmanac.services.topics.requests import ListTopicsRequest, ShowTopicRequest


def test_topics_list_and_show_descendants(tmp_path: Path, isolated_home: Path):
    repo = make_topic_repo(tmp_path)
    app = create_app(AppConfig(registry_path=isolated_home / ".almanac/registry.json"))

    topics = app.topics.list(ListTopicsRequest(cwd=repo))
    auth = app.topics.show(
        ShowTopicRequest(cwd=repo, slug="auth", include_descendants=True)
    )

    counts = {topic.slug: topic.page_count for topic in topics}
    assert counts["auth"] == 1
    assert counts["jwt"] == 1
    assert counts["empty-topic"] == 0
    assert auth.parents == ("concepts",)
    assert auth.children == ("jwt",)
    assert auth.pages == ("auth-flow", "empty-page")


def test_health_reports_read_model_problems(tmp_path: Path, isolated_home: Path):
    repo = make_topic_repo(tmp_path)
    app = create_app(AppConfig(registry_path=isolated_home / ".almanac/registry.json"))

    report = app.health.check(HealthCheckRequest(cwd=repo))

    assert {item.slug for item in report.orphans} == {"orphan"}
    assert [(item.slug, item.path) for item in report.dead_refs] == [
        ("auth-flow", "src/missing.py")
    ]
    assert [(item.source_slug, item.target_slug) for item in report.broken_links] == [
        ("auth-flow", "missing-page")
    ]
    assert [
        (item.source_slug, item.target_wiki, item.target_slug)
        for item in report.broken_xwiki
    ] == [("auth-flow", "unknown", "thing")]
    assert "empty-topic" in {item.slug for item in report.empty_topics}
    assert {item.slug for item in report.empty_pages} == {"empty-page"}


def test_malformed_topics_yaml_does_not_break_reads(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    pages = repo / ".almanac/pages"
    pages.mkdir(parents=True)
    (repo / ".almanac/topics.yaml").write_text("topics: [", encoding="utf-8")
    (pages / "note.md").write_text("# Note\n\nBody.\n", encoding="utf-8")
    app = create_app(AppConfig(registry_path=isolated_home / ".almanac/registry.json"))

    topics = app.topics.list(ListTopicsRequest(cwd=repo))
    report = app.health.check(HealthCheckRequest(cwd=repo))

    assert topics == ()
    assert {item.slug for item in report.orphans} == {"note"}


def make_topic_repo(tmp_path: Path) -> Path:
    repo = tmp_path / "repo"
    pages = repo / ".almanac/pages"
    pages.mkdir(parents=True)
    (repo / ".almanac/topics.yaml").write_text(
        """topics:
  - slug: concepts
    title: Concepts
    parents: []
  - slug: auth
    title: Auth
    description: Authentication
    parents: [concepts]
  - slug: jwt
    title: JWT
    parents: [auth]
  - slug: empty-topic
    title: Empty Topic
    parents: []
""",
        encoding="utf-8",
    )
    (pages / "auth-flow.md").write_text(
        """---
title: Auth Flow
topics: [jwt]
---
# Auth Flow

Login uses [[src/missing.py]], [[missing-page]], and [[unknown:thing]].
""",
        encoding="utf-8",
    )
    (pages / "orphan.md").write_text("# Orphan\n\nNo topic yet.\n", encoding="utf-8")
    (pages / "empty-page.md").write_text(
        "---\ntopics: [auth]\n---\n# Empty Page\n",
        encoding="utf-8",
    )
    return repo
