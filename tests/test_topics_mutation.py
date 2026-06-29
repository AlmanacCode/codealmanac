from pathlib import Path

import pytest

from codealmanac.app import create_app
from codealmanac.core.errors import ConflictError, NotFoundError, ValidationFailed
from codealmanac.core.models import AppConfig
from codealmanac.services.topics.models import TopicMutationAction
from codealmanac.services.topics.requests import (
    CreateTopicRequest,
    DescribeTopicRequest,
    LinkTopicRequest,
    ShowTopicRequest,
    UnlinkTopicRequest,
)


def test_create_topic_with_parent_preserves_topics_yaml_comment(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = make_repo(tmp_path)
    app = create_app(AppConfig(registry_path=isolated_home / ".almanac/registry.json"))

    result = app.topics.create(
        CreateTopicRequest(cwd=repo, name="Auth", parents=("concepts",))
    )
    auth = app.topics.show(ShowTopicRequest(cwd=repo, slug="auth"))

    raw = (repo / ".almanac/topics.yaml").read_text(encoding="utf-8")
    assert result.action == TopicMutationAction.CREATED
    assert auth.parents == ("concepts",)
    assert "# keep this comment" in raw
    assert "slug: auth" in raw


def test_create_rejects_missing_parent_without_overwriting_file(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = make_repo(tmp_path)
    topics_path = repo / ".almanac/topics.yaml"
    before = topics_path.read_text(encoding="utf-8")
    app = create_app(AppConfig(registry_path=isolated_home / ".almanac/registry.json"))

    with pytest.raises(NotFoundError):
        app.topics.create(
            CreateTopicRequest(cwd=repo, name="Auth", parents=("missing",))
        )

    assert topics_path.read_text(encoding="utf-8") == before


def test_link_promotes_ad_hoc_page_topic_and_rejects_cycle(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = make_repo(tmp_path)
    pages = repo / ".almanac/pages"
    (pages / "jwt.md").write_text(
        "---\ntopics: [jwt]\n---\n# JWT\n\nToken notes.\n",
        encoding="utf-8",
    )
    app = create_app(AppConfig(registry_path=isolated_home / ".almanac/registry.json"))

    linked = app.topics.link(LinkTopicRequest(cwd=repo, child="jwt", parent="concepts"))

    raw = (repo / ".almanac/topics.yaml").read_text(encoding="utf-8")
    concepts = app.topics.show(ShowTopicRequest(cwd=repo, slug="concepts"))
    assert linked.action == TopicMutationAction.LINKED
    assert concepts.children == ("jwt",)
    assert "slug: jwt" in raw
    with pytest.raises(ConflictError):
        app.topics.link(LinkTopicRequest(cwd=repo, child="concepts", parent="jwt"))


def test_describe_promotes_ad_hoc_page_topic(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = make_repo(tmp_path)
    pages = repo / ".almanac/pages"
    (pages / "runtime.md").write_text(
        "---\ntopics: [runtime]\n---\n# Runtime\n",
        encoding="utf-8",
    )
    app = create_app(AppConfig(registry_path=isolated_home / ".almanac/registry.json"))

    result = app.topics.describe(
        DescribeTopicRequest(
            cwd=repo,
            slug="runtime",
            description="Runtime assumptions",
        )
    )
    runtime = app.topics.show(ShowTopicRequest(cwd=repo, slug="runtime"))

    assert result.action == TopicMutationAction.DESCRIBED
    assert runtime.description == "Runtime assumptions"
    raw = (repo / ".almanac/topics.yaml").read_text(encoding="utf-8")
    assert "slug: runtime" in raw
    assert "description: Runtime assumptions" in raw


def test_unlink_removes_edge_and_is_idempotent(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = make_repo(tmp_path)
    app = create_app(AppConfig(registry_path=isolated_home / ".almanac/registry.json"))
    app.topics.create(CreateTopicRequest(cwd=repo, name="Auth", parents=("concepts",)))

    removed = app.topics.unlink(
        UnlinkTopicRequest(cwd=repo, child="auth", parent="concepts")
    )
    second = app.topics.unlink(
        UnlinkTopicRequest(cwd=repo, child="auth", parent="concepts")
    )
    auth = app.topics.show(ShowTopicRequest(cwd=repo, slug="auth"))

    assert removed.action == TopicMutationAction.UNLINKED
    assert second.action == TopicMutationAction.NO_EDGE
    assert auth.parents == ()


def test_mutating_malformed_topics_yaml_fails_without_overwrite(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = make_repo(tmp_path)
    topics_path = repo / ".almanac/topics.yaml"
    topics_path.write_text("topics: [", encoding="utf-8")
    app = create_app(AppConfig(registry_path=isolated_home / ".almanac/registry.json"))

    with pytest.raises(ValidationFailed):
        app.topics.create(CreateTopicRequest(cwd=repo, name="Auth"))

    assert topics_path.read_text(encoding="utf-8") == "topics: ["


def make_repo(tmp_path: Path) -> Path:
    repo = tmp_path / "repo"
    (repo / ".almanac/pages").mkdir(parents=True)
    (repo / ".almanac/topics.yaml").write_text(
        """# keep this comment
topics:
  - slug: concepts
    title: Concepts
    parents: []
""",
        encoding="utf-8",
    )
    return repo
