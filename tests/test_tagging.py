from pathlib import Path

from codealmanac.app import create_app
from codealmanac.core.models import AppConfig
from codealmanac.services.tagging.requests import TagPageRequest, UntagPageRequest


def test_tag_adds_topic_preserves_body_and_frontmatter_comment(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = make_repo(tmp_path)
    page = repo / ".almanac/pages/auth-flow.md"
    body = "# Auth Flow\n\nDo not change this body.\n"
    page.write_text(
        f"---\ntitle: Auth Flow\n# keep this comment\ntopics: [auth]\n---\n{body}",
        encoding="utf-8",
    )
    app = create_app(AppConfig(registry_path=isolated_home / ".almanac/registry.json"))

    result = app.tagging.tag(
        TagPageRequest(cwd=repo, slug="auth-flow", topics=("sessions",))
    )
    second = app.tagging.tag(
        TagPageRequest(cwd=repo, slug="auth-flow", topics=("sessions",))
    )

    raw = page.read_bytes().decode("utf-8")
    assert result.changed_topics == ("sessions",)
    assert second.changed_topics == ()
    assert "# keep this comment" in raw
    assert raw.endswith(body)


def test_untag_removes_topic_and_allows_orphan_page(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = make_repo(tmp_path)
    page = repo / ".almanac/pages/auth-flow.md"
    page.write_text(
        "---\ntitle: Auth Flow\ntopics: [auth]\n---\n# Auth Flow\n",
        encoding="utf-8",
    )
    app = create_app(AppConfig(registry_path=isolated_home / ".almanac/registry.json"))

    result = app.tagging.untag(
        UntagPageRequest(cwd=repo, slug="auth-flow", topics=("auth",))
    )

    raw = page.read_bytes().decode("utf-8")
    assert result.changed_topics == ("auth",)
    assert "topics: []" in raw


def test_tag_adds_frontmatter_when_page_has_none(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = make_repo(tmp_path)
    page = repo / ".almanac/pages/note.md"
    page.write_text("# Note\n\nBody.\n", encoding="utf-8")
    app = create_app(AppConfig(registry_path=isolated_home / ".almanac/registry.json"))

    app.tagging.tag(TagPageRequest(cwd=repo, slug="note", topics=("concepts",)))

    raw = page.read_bytes().decode("utf-8")
    assert raw.startswith("---\ntopics:\n- concepts\n---\n")
    assert raw.endswith("# Note\n\nBody.\n")


def test_tag_handles_frontmatter_closing_fence_at_eof(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = make_repo(tmp_path)
    page = repo / ".almanac/pages/note.md"
    page.write_text("---\ntitle: Note\n---", encoding="utf-8")
    app = create_app(AppConfig(registry_path=isolated_home / ".almanac/registry.json"))

    app.tagging.tag(TagPageRequest(cwd=repo, slug="note", topics=("concepts",)))

    raw = page.read_text(encoding="utf-8")
    assert raw.count("---") == 2
    assert "title: Note" in raw
    assert "concepts" in raw


def test_tag_preserves_crlf_frontmatter_and_body(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = make_repo(tmp_path)
    page = repo / ".almanac/pages/auth-flow.md"
    body = "# Auth Flow\r\n\r\nBody.\r\n"
    page.write_text(
        f"---\r\ntitle: Auth Flow\r\ntopics:\r\n  - auth\r\n---\r\n{body}",
        encoding="utf-8",
    )
    app = create_app(AppConfig(registry_path=isolated_home / ".almanac/registry.json"))

    app.tagging.tag(TagPageRequest(cwd=repo, slug="auth-flow", topics=("sessions",)))

    raw = page.read_bytes().decode("utf-8")
    frontmatter = raw.split("# Auth Flow", maxsplit=1)[0]
    assert "\r\n" in frontmatter
    assert raw.endswith(body)


def make_repo(tmp_path: Path) -> Path:
    repo = tmp_path / "repo"
    (repo / ".almanac/pages").mkdir(parents=True)
    return repo
