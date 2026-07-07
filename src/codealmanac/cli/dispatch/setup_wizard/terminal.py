import os
import select
import sys
import termios
import tty
from collections.abc import Iterator
from contextlib import contextmanager


def supports_interactive_setup() -> bool:
    return sys.stdin.isatty() and sys.stdout.isatty()


@contextmanager
def wizard_terminal() -> Iterator[None]:
    """Own the terminal for the wizard's lifetime."""
    try:
        fd = sys.stdin.fileno()
        previous = termios.tcgetattr(fd)
    except (OSError, termios.error):
        yield
        return
    sys.stdout.write("\x1b[?1049h\x1b[?25l")
    sys.stdout.flush()
    tty.setcbreak(fd)
    try:
        yield
    finally:
        termios.tcsetattr(fd, termios.TCSADRAIN, previous)
        sys.stdout.write("\x1b[?25h\x1b[?1049l")
        sys.stdout.flush()


def read_setup_key() -> str:
    fd = sys.stdin.fileno()
    sys.stdout.flush()
    key = os.read(fd, 1).decode("utf-8", errors="ignore")
    if key != "\x1b":
        return key
    for _ in range(2):
        ready, _, _ = select.select([fd], [], [], 0.05)
        if len(ready) == 0:
            return key
        key += os.read(fd, 1).decode("utf-8", errors="ignore")
    return key
