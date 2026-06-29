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


def test_cli_build_and_reindex_commands(
    tmp_path: Path,
    isolated_home: Path,
    monkeypatch,
    capsys,
):
    repo = tmp_path / "repo"
    repo.mkdir()

    assert main(["build", str(repo)]) == 0
    build_output = capsys.readouterr()
    assert build_output.out == "built repo: 1 page (1 updated, 0 removed)\n"
    assert (repo / ".almanac/index.db").is_file()

    (repo / ".almanac/pages/note.md").write_text(
        "# Note\n\nReindexNeedle.\n",
        encoding="utf-8",
    )
    monkeypatch.chdir(repo)

    assert main(["reindex"]) == 0
    reindex_output = capsys.readouterr()
    assert reindex_output.out == "reindexed: 2 pages (2 updated, 0 removed)\n"

    assert main(["reindex", "--json"]) == 0
    json_output = capsys.readouterr()
    assert '"pages_indexed": 2' in json_output.out


def test_cli_reindex_can_target_registered_wiki(
    tmp_path: Path,
    isolated_home: Path,
    monkeypatch,
    capsys,
):
    first = tmp_path / "first"
    second = tmp_path / "second"
    first.mkdir()
    second.mkdir()

    assert main(["build", str(first), "--name", "first"]) == 0
    capsys.readouterr()
    assert main(["build", str(second), "--name", "second"]) == 0
    capsys.readouterr()
    (first / ".almanac/pages/remote.md").write_text(
        "# Remote\n\nTargeted reindex.\n",
        encoding="utf-8",
    )
    monkeypatch.chdir(second)

    assert main(["reindex", "--wiki", "first"]) == 0

    output = capsys.readouterr()
    assert output.out == "reindexed: 2 pages (2 updated, 0 removed)\n"


def test_cli_doctor_reports_local_state(
    tmp_path: Path,
    isolated_home: Path,
    monkeypatch,
    capsys,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    assert main(["build", str(repo)]) == 0
    capsys.readouterr()
    monkeypatch.chdir(repo)

    assert main(["doctor"]) == 0

    output = capsys.readouterr()
    assert "codealmanac v0.1.0\n" in output.out
    assert "## Install\n" in output.out
    assert f"repo: {repo}\n" in output.out
    assert "index: 1 page, 4 topics" in output.out


def test_cli_doctor_json_reports_no_wiki(
    tmp_path: Path,
    isolated_home: Path,
    monkeypatch,
    capsys,
):
    monkeypatch.chdir(tmp_path)

    assert main(["doctor", "--json"]) == 0

    output = capsys.readouterr()
    assert '"key": "wiki.none"' in output.out
    assert '"fix": "run: codealmanac init"' in output.out


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

    assert main(["topics", "rename", "auth", "security"]) == 0
    rename_output = capsys.readouterr()
    assert rename_output.out == "renamed auth -> security (0 pages updated)\n"

    assert main(["topics", "delete", "security"]) == 0
    delete_output = capsys.readouterr()
    assert delete_output.out == "deleted security (0 pages untagged)\n"
