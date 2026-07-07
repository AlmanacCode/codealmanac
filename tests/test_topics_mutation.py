from pathlib import Path

import pytest

from codealmanac.app import create_app
from codealmanac.core.errors import ConflictError, NotFoundError, ValidationFailed
from codealmanac.services.topics.models import TopicMutationAction
from codealmanac.services.topics.requests import (
    CreateTopicRequest,
    DeleteTopicRequest,
    DescribeTopicRequest,
    LinkTopicRequest,
    RenameTopicRequest,
    ShowTopicRequest,
    UnlinkTopicRequest,
)
from codealmanac.settings import AppConfig


def test_create_topic_with_parent_preserves_topics_yaml_comment(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = make_repo(tmp_path)
    app = create_app(
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db")
    )

    result = app.topics.create(
        CreateTopicRequest(cwd=repo, name="Auth", parents=("concepts",))
    )
    auth = app.topics.show(ShowTopicRequest(cwd=repo, slug="auth"))

    raw = (repo / "almanac/topics.yaml").read_text(encoding="utf-8")
    assert result.action == TopicMutationAction.CREATED
    assert auth.parents == ("concepts",)
    assert "# keep this comment" in raw
    assert "slug: auth" in raw


def test_create_rejects_missing_parent_without_overwriting_file(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = make_repo(tmp_path)
    topics_path = repo / "almanac/topics.yaml"
    before = topics_path.read_text(encoding="utf-8")
    app = create_app(
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db")
    )

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
    pages = repo / "almanac"
    (pages / "jwt.md").write_text(
        "---\ntopics: [jwt]\n---\n# JWT\n\nToken notes.\n",
        encoding="utf-8",
    )
    app = create_app(
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db")
    )

    linked = app.topics.link(LinkTopicRequest(cwd=repo, child="jwt", parent="concepts"))

    raw = (repo / "almanac/topics.yaml").read_text(encoding="utf-8")
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
    pages = repo / "almanac"
    (pages / "runtime.md").write_text(
        "---\ntopics: [runtime]\n---\n# Runtime\n",
        encoding="utf-8",
    )
    app = create_app(
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db")
    )

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
    raw = (repo / "almanac/topics.yaml").read_text(encoding="utf-8")
    assert "slug: runtime" in raw
    assert "description: Runtime assumptions" in raw


def test_unlink_removes_edge_and_is_idempotent(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = make_repo(tmp_path)
    app = create_app(
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db")
    )
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
    topics_path = repo / "almanac/topics.yaml"
    topics_path.write_text("topics: [", encoding="utf-8")
    app = create_app(
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db")
    )

    with pytest.raises(ValidationFailed):
        app.topics.create(CreateTopicRequest(cwd=repo, name="Auth"))

    assert topics_path.read_text(encoding="utf-8") == "topics: ["


def test_rename_updates_topics_yaml_parent_edges_and_page_frontmatter(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = make_repo(tmp_path)
    topics_path = repo / "almanac/topics.yaml"
    pages = repo / "almanac"
    topics_path.write_text(
        """# keep this comment
topics:
  - slug: concepts
    title: Concepts
    parents: []
  - slug: auth
    title: Auth
    parents: [concepts]
  - slug: jwt
    title: JWT
    parents: [auth]
""",
        encoding="utf-8",
    )
    (pages / "auth-flow.md").write_text(
        "---\ntitle: Auth Flow\n# page comment\ntopics: [auth]\n---\n# Auth Flow\n",
        encoding="utf-8",
    )
    app = create_app(
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db")
    )

    result = app.topics.rename(
        RenameTopicRequest(cwd=repo, old_slug="auth", new_slug="security")
    )
    security = app.topics.show(ShowTopicRequest(cwd=repo, slug="security"))
    jwt = app.topics.show(ShowTopicRequest(cwd=repo, slug="jwt"))

    assert result.action == TopicMutationAction.RENAMED
    assert result.pages_updated == 1
    assert security.parents == ("concepts",)
    assert security.pages == ("auth-flow",)
    assert jwt.parents == ("security",)
    raw_topics = topics_path.read_text(encoding="utf-8")
    raw_page = (pages / "auth-flow.md").read_text(encoding="utf-8")
    assert "# keep this comment" in raw_topics
    assert "slug: security" in raw_topics
    assert "- security" in raw_topics
    assert "# page comment" in raw_page
    assert "security" in raw_page
    assert "# Auth Flow\n" in raw_page


def test_rename_refuses_merge_without_writing_files(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = make_repo(tmp_path)
    topics_path = repo / "almanac/topics.yaml"
    pages = repo / "almanac"
    topics_path.write_text(
        """topics:
  - slug: auth
    title: Auth
    parents: []
  - slug: security
    title: Security
    parents: []
""",
        encoding="utf-8",
    )
    page_path = pages / "auth-flow.md"
    page_path.write_text(
        "---\ntopics: [auth]\n---\n# Auth Flow\n",
        encoding="utf-8",
    )
    before_topics = topics_path.read_text(encoding="utf-8")
    before_page = page_path.read_text(encoding="utf-8")
    app = create_app(
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db")
    )

    with pytest.raises(ConflictError):
        app.topics.rename(
            RenameTopicRequest(cwd=repo, old_slug="auth", new_slug="security")
        )

    assert topics_path.read_text(encoding="utf-8") == before_topics
    assert page_path.read_text(encoding="utf-8") == before_page


def test_rename_same_slug_is_noop_without_requiring_topic(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = make_repo(tmp_path)
    topics_path = repo / "almanac/topics.yaml"
    before = topics_path.read_text(encoding="utf-8")
    app = create_app(
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db")
    )

    result = app.topics.rename(
        RenameTopicRequest(cwd=repo, old_slug="missing", new_slug="missing")
    )

    assert result.action == TopicMutationAction.UNCHANGED
    assert result.pages_updated == 0
    assert topics_path.read_text(encoding="utf-8") == before


def test_rename_page_only_ad_hoc_topic(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = make_repo(tmp_path)
    page_path = repo / "almanac/runtime.md"
    page_path.write_text(
        "---\ntopics: [runtime]\n---\n# Runtime\n",
        encoding="utf-8",
    )
    app = create_app(
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db")
    )

    result = app.topics.rename(
        RenameTopicRequest(cwd=repo, old_slug="runtime", new_slug="python-runtime")
    )
    renamed = app.topics.show(ShowTopicRequest(cwd=repo, slug="python-runtime"))

    assert result.pages_updated == 1
    assert renamed.pages == ("runtime",)
    assert "python-runtime" in page_path.read_text(encoding="utf-8")


def test_delete_removes_topic_edges_and_page_frontmatter_without_deleting_pages(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = make_repo(tmp_path)
    topics_path = repo / "almanac/topics.yaml"
    pages = repo / "almanac"
    topics_path.write_text(
        """topics:
  - slug: auth
    title: Auth
    parents: []
  - slug: jwt
    title: JWT
    parents: [auth]
""",
        encoding="utf-8",
    )
    page_path = pages / "auth-flow.md"
    page_path.write_text(
        "---\ntopics: [auth, jwt]\n---\n# Auth Flow\n",
        encoding="utf-8",
    )
    app = create_app(
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db")
    )

    result = app.topics.delete(DeleteTopicRequest(cwd=repo, slug="auth"))
    jwt = app.topics.show(ShowTopicRequest(cwd=repo, slug="jwt"))

    assert result.action == TopicMutationAction.DELETED
    assert result.pages_updated == 1
    assert page_path.is_file()
    assert jwt.parents == ()
    assert "slug: auth" not in topics_path.read_text(encoding="utf-8")
    assert "topics: [jwt]" in page_path.read_text(encoding="utf-8")
    with pytest.raises(NotFoundError):
        app.topics.show(ShowTopicRequest(cwd=repo, slug="auth"))


def test_delete_refuses_missing_topic_without_writing_files(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = make_repo(tmp_path)
    topics_path = repo / "almanac/topics.yaml"
    before = topics_path.read_text(encoding="utf-8")
    app = create_app(
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db")
    )

    with pytest.raises(NotFoundError):
        app.topics.delete(DeleteTopicRequest(cwd=repo, slug="missing"))

    assert topics_path.read_text(encoding="utf-8") == before


def test_rename_malformed_page_frontmatter_fails_before_topics_yaml_write(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = make_repo(tmp_path)
    topics_path = repo / "almanac/topics.yaml"
    topics_path.write_text(
        """topics:
  - slug: auth
    title: Auth
    parents: []
""",
        encoding="utf-8",
    )
    (repo / "almanac/broken.md").write_text(
        "---\ntopics: [\n---\n# Broken\n",
        encoding="utf-8",
    )
    before = topics_path.read_text(encoding="utf-8")
    app = create_app(
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db")
    )

    with pytest.raises(ValidationFailed):
        app.topics.rename(
            RenameTopicRequest(cwd=repo, old_slug="auth", new_slug="security")
        )

    assert topics_path.read_text(encoding="utf-8") == before


def make_repo(tmp_path: Path) -> Path:
    repo = tmp_path / "repo"
    (repo / "almanac").mkdir(parents=True)
    (repo / "almanac/README.md").write_text(
        "---\ntopics: [concepts]\n---\n# Wiki\n\nRoot page.\n",
        encoding="utf-8",
    )
    (repo / "almanac/topics.yaml").write_text(
        """# keep this comment
topics:
  - slug: concepts
    title: Concepts
    parents: []
""",
        encoding="utf-8",
    )
    return repo
