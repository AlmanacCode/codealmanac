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
