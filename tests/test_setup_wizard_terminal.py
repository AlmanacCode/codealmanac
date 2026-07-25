import os
import pty
import sys
import termios

import pytest

from codealmanac.cli.dispatch.setup_wizard.terminal import (
    read_setup_key,
    supports_interactive_setup,
    wizard_terminal,
)


@pytest.fixture
def terminal(monkeypatch):
    """A real pty wired to sys.stdin so the wizard sees a terminal."""
    controller, follower = pty.openpty()
    previous = termios.tcgetattr(follower)
    stdin = os.fdopen(follower, "rb", buffering=0)
    monkeypatch.setattr(sys, "stdin", stdin)
    try:
        yield controller
    finally:
        termios.tcsetattr(follower, termios.TCSADRAIN, previous)
        stdin.close()
        os.close(controller)


def test_interactive_setup_needs_a_terminal_on_both_streams(terminal, monkeypatch):
    assert supports_interactive_setup() is False

    monkeypatch.setattr(sys.stdout, "isatty", lambda: True)

    assert supports_interactive_setup() is True


def test_wizard_terminal_switches_to_the_alternate_screen_and_restores(
    terminal,
    capsys,
):
    fd = sys.stdin.fileno()
    before = termios.tcgetattr(fd)

    with wizard_terminal():
        during = termios.tcgetattr(fd)

    out = capsys.readouterr().out
    assert out.startswith("\x1b[?1049h\x1b[?25l")
    assert out.endswith("\x1b[?25h\x1b[?1049l")
    assert during != before
    assert termios.tcgetattr(fd) == before


def test_wizard_terminal_is_a_no_op_without_a_terminal(capsys):
    with wizard_terminal():
        pass

    assert capsys.readouterr().out == ""


def test_read_setup_key_returns_a_single_character(terminal):
    os.write(terminal, b"q")

    with wizard_terminal():
        assert read_setup_key() == "q"


def test_read_setup_key_reads_a_whole_arrow_sequence(terminal):
    os.write(terminal, b"\x1b[B")

    with wizard_terminal():
        assert read_setup_key() == "\x1b[B"


def test_read_setup_key_returns_a_lone_escape_when_nothing_follows(terminal):
    os.write(terminal, b"\x1b")

    with wizard_terminal():
        assert read_setup_key() == "\x1b"
