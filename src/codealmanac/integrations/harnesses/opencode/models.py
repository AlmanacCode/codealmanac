from __future__ import annotations

import shutil
import subprocess
from collections.abc import Callable

from codealmanac.services.config.opencode_models import (
    OPENCODE_FALLBACK_MODELS,
    is_opencode_model_id,
)

OPENCODE_BINARY = "opencode"
OPENCODE_MODELS_TIMEOUT_SECONDS = 20

CommandRunner = Callable[[tuple[str, ...], float], tuple[int, str, str]]


def list_opencode_models(
    *,
    binary: str = OPENCODE_BINARY,
    timeout_seconds: float = OPENCODE_MODELS_TIMEOUT_SECONDS,
    runner: CommandRunner | None = None,
    which: Callable[[str], str | None] | None = None,
) -> tuple[str, ...]:
    """Return model ids from `opencode models`, or ()."""
    locate = which or shutil.which
    path = locate(binary)
    if path is None:
        return ()
    run = runner or run_command
    try:
        code, stdout, _stderr = run((path, "models"), timeout_seconds)
    except (OSError, subprocess.TimeoutExpired):
        return ()
    if code != 0:
        return ()
    return parse_opencode_models_output(stdout)


def models_for_selection(
    *,
    binary: str = OPENCODE_BINARY,
    timeout_seconds: float = OPENCODE_MODELS_TIMEOUT_SECONDS,
    runner: CommandRunner | None = None,
    which: Callable[[str], str | None] | None = None,
) -> tuple[str, ...]:
    """Prefer live catalog; fall back to a short curated list."""
    discovered = list_opencode_models(
        binary=binary,
        timeout_seconds=timeout_seconds,
        runner=runner,
        which=which,
    )
    if discovered:
        return discovered
    return OPENCODE_FALLBACK_MODELS


def parse_opencode_models_output(stdout: str) -> tuple[str, ...]:
    seen: set[str] = set()
    models: list[str] = []
    for line in stdout.splitlines():
        token = line.strip()
        if not is_opencode_model_id(token) or token in seen:
            continue
        seen.add(token)
        models.append(token)
    return tuple(models)


def run_command(
    command: tuple[str, ...],
    timeout_seconds: float,
) -> tuple[int, str, str]:
    completed = subprocess.run(
        command,
        capture_output=True,
        text=True,
        timeout=timeout_seconds,
        check=False,
    )
    return completed.returncode, completed.stdout or "", completed.stderr or ""
