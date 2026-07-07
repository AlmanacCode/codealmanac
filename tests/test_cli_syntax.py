import sys

import pytest

from codealmanac.cli.main import build_parser, main
from codealmanac.cli.syntax.models import CliSyntaxError, SyntaxProblemKind


def test_jobs_list_renders_readable_replacement(capsys):
    assert main(["jobs", "list"]) == 2

    output = capsys.readouterr()
    assert output.out == ""
    assert "◆ codealmanac\n" in output.err
    assert "Unknown command\n" in output.err
    assert "You ran:\n  codealmanac jobs list\n" in output.err
    assert "Use this instead:\n  codealmanac jobs\n" in output.err
    assert "Jobs commands\n" in output.err
    assert "codealmanac jobs show <run-id>" in output.err


def test_topics_list_renders_readable_replacement(capsys):
    assert main(["topics", "list"]) == 2

    output = capsys.readouterr()
    assert output.out == ""
    assert "Use this instead:\n  codealmanac topics\n" in output.err
    assert "Topics commands\n" in output.err
    assert "codealmanac topics show <slug>" in output.err


def test_required_subcommand_renders_command_table(capsys):
    assert main(["config"]) == 2

    output = capsys.readouterr()
    assert output.out == ""
    assert "Missing command\n" in output.err
    assert "You ran:\n  codealmanac config\n" in output.err
    assert "Config commands\n" in output.err
    assert "codealmanac config list" in output.err


def test_unknown_top_level_command_hides_internal_commands(capsys):
    assert main(["build"]) == 2

    output = capsys.readouterr()
    assert output.out == ""
    assert "Unknown command\n" in output.err
    assert "CodeAlmanac commands\n" in output.err
    assert "__run-worker" not in output.err
    assert "__garden-scheduler" not in output.err


def test_unknown_option_uses_command_guide(capsys):
    assert main(["search", "--include-archive"]) == 2

    output = capsys.readouterr()
    assert output.out == ""
    assert "Unknown option\n" in output.err
    assert "You ran:\n  codealmanac search --include-archive\n" in output.err
    assert "Search options\n" in output.err
    assert "codealmanac search --mentions src/app.py" in output.err


def test_parser_raises_shaped_syntax_problem_without_rendering(capsys):
    parser = build_parser()

    with pytest.raises(CliSyntaxError) as error:
        parser.parse_args(("serch",))

    output = capsys.readouterr()
    assert output.out == ""
    assert output.err == ""
    assert error.value.problem.kind == SyntaxProblemKind.UNKNOWN_COMMAND
    assert error.value.problem.replacement == "codealmanac search"


def test_syntax_screen_uses_blue_hierarchy_for_terminal(monkeypatch, capsys):
    monkeypatch.delenv("NO_COLOR", raising=False)
    monkeypatch.setattr(sys.stdout, "isatty", lambda: True)

    assert main(["jobs", "list"]) == 2

    output = capsys.readouterr()
    assert "\x1b[38;5;75m\x1b[1mUnknown command\x1b[0m" in output.err
    assert "\x1b[38;5;75mUse this instead:\x1b[0m" in output.err
    assert "\x1b[38;5;75m\x1b[1mJobs commands\x1b[0m" in output.err
    assert "\x1b[38;5;75m\x1b[1mCOMMAND" in output.err
    assert "\x1b[38;5;75mcodealmanac jobs show <run-id>\x1b[0m" in output.err
