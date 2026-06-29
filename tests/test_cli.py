from pathlib import Path

from codealmanac.cli.main import main


def test_cli_init_creates_wiki_and_prints_name(
    tmp_path: Path,
    isolated_home: Path,
    capsys,
):
    repo = tmp_path / "My Repo"
    repo.mkdir()

    exit_code = main(["init", str(repo), "--description", "cli test"])

    captured = capsys.readouterr()
    assert exit_code == 0
    assert captured.out == "my-repo\n"
    assert "initialized" in captured.err
    assert (repo / ".almanac/pages/getting-started.md").is_file()
    assert (isolated_home / ".almanac/registry.json").is_file()


def test_cli_list_outputs_registered_wikis(
    tmp_path: Path,
    isolated_home: Path,
    capsys,
):
    repo = tmp_path / "repo"
    repo.mkdir()

    assert main(["init", str(repo)]) == 0
    capsys.readouterr()

    exit_code = main(["list"])

    captured = capsys.readouterr()
    assert exit_code == 0
    assert captured.out == f"repo\t{repo}\n"


def test_cli_search_and_show_read_current_repo_wiki(
    tmp_path: Path,
    isolated_home: Path,
    monkeypatch,
    capsys,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    assert main(["init", str(repo)]) == 0
    capsys.readouterr()
    page_path = repo / ".almanac/pages/auth-flow.md"
    page_path.write_text(
        """---
title: Auth Flow
topics: [auth]
files:
  - src/auth/
---
# Auth Flow

Login reads [[src/auth/session.py]].
""",
        encoding="utf-8",
    )
    monkeypatch.chdir(repo)

    assert main(["search", "login"]) == 0
    search_output = capsys.readouterr()
    assert search_output.out == "auth-flow\n"

    assert main(["show", "auth-flow", "--lead"]) == 0
    show_output = capsys.readouterr()
    assert show_output.out == "# Auth Flow\n"

    assert main(["show", "auth-flow", "--body", "--meta"]) == 0
    body_output = capsys.readouterr()
    assert body_output.out.startswith("# Auth Flow\n\nLogin reads")

    assert main(["search", "missing"]) == 0
    empty_output = capsys.readouterr()
    assert empty_output.out == ""
    assert empty_output.err == "# 0 results\n"


def test_cli_topics_and_health_read_current_repo_wiki(
    tmp_path: Path,
    isolated_home: Path,
    monkeypatch,
    capsys,
):
    repo = tmp_path / "repo"
    pages = repo / ".almanac/pages"
    pages.mkdir(parents=True)
    (repo / ".almanac/topics.yaml").write_text(
        """topics:
  - slug: auth
    title: Auth
    parents: []
  - slug: empty-topic
    title: Empty Topic
    parents: []
""",
        encoding="utf-8",
    )
    (pages / "auth-flow.md").write_text(
        "---\ntopics: [auth]\n---\n# Auth Flow\n\nSee [[missing-page]].\n",
        encoding="utf-8",
    )
    monkeypatch.chdir(repo)

    assert main(["topics"]) == 0
    topics_output = capsys.readouterr()
    assert "auth\t1\tAuth\n" in topics_output.out

    assert main(["topics", "show", "auth"]) == 0
    topic_output = capsys.readouterr()
    assert "pages:\n  auth-flow\n" in topic_output.out

    assert main(["health", "--json"]) == 0
    health_output = capsys.readouterr()
    assert '"broken_links": [' in health_output.out
    assert '"target_slug": "missing-page"' in health_output.out


def test_cli_tag_and_untag_update_page_frontmatter(
    tmp_path: Path,
    isolated_home: Path,
    monkeypatch,
    capsys,
):
    repo = tmp_path / "repo"
    pages = repo / ".almanac/pages"
    pages.mkdir(parents=True)
    page = pages / "auth-flow.md"
    page.write_text("---\ntopics: [auth]\n---\n# Auth Flow\n", encoding="utf-8")
    monkeypatch.chdir(repo)

    assert main(["tag", "auth-flow", "sessions"]) == 0
    tag_output = capsys.readouterr()
    assert tag_output.out == "auth-flow: tagged sessions\n"

    assert main(["untag", "auth-flow", "auth"]) == 0
    untag_output = capsys.readouterr()
    assert untag_output.out == "auth-flow: untagged auth\n"

    assert main(["untag", "auth-flow", "missing"]) == 0
    noop_output = capsys.readouterr()
    assert noop_output.out == "auth-flow: not tagged missing\n"

    assert "sessions" in page.read_text(encoding="utf-8")


def test_cli_topics_mutation_commands(
    tmp_path: Path,
    isolated_home: Path,
    monkeypatch,
    capsys,
):
    repo = tmp_path / "repo"
    pages = repo / ".almanac/pages"
    pages.mkdir(parents=True)
    (repo / ".almanac/topics.yaml").write_text(
        """topics:
  - slug: concepts
    title: Concepts
    parents: []
""",
        encoding="utf-8",
    )
    monkeypatch.chdir(repo)

    assert main(["topics", "create", "Auth", "--parent", "concepts"]) == 0
    create_output = capsys.readouterr()
    assert create_output.out == "auth: created\n"

    assert main(["topics", "describe", "auth", "Authentication"]) == 0
    describe_output = capsys.readouterr()
    assert describe_output.out == "auth: described\n"

    assert main(["topics", "create", "JWT"]) == 0
    capsys.readouterr()
    assert main(["topics", "link", "jwt", "auth"]) == 0
    link_output = capsys.readouterr()
    assert link_output.out == "linked jwt -> auth\n"

    assert main(["topics", "show", "auth"]) == 0
    show_output = capsys.readouterr()
    assert "description: Authentication\n" in show_output.out
    assert "children: jwt\n" in show_output.out
