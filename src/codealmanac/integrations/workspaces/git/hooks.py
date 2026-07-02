import stat
import subprocess
from pathlib import Path

from codealmanac.core.errors import ExecutionFailed
from codealmanac.services.local_hooks.models import (
    LocalGitHookChange,
    LocalGitHookName,
)

LOCAL_TRIGGER_START = "# codealmanac:local-trigger:start"
LOCAL_TRIGGER_END = "# codealmanac:local-trigger:end"
HOOK_TIMEOUT_SECONDS = 10
TRIGGER_KIND_BY_HOOK = {
    LocalGitHookName.POST_COMMIT: "local_post_commit",
    LocalGitHookName.POST_MERGE: "local_post_merge",
    LocalGitHookName.POST_REWRITE: "local_post_rewrite",
}


class FileLocalGitHookManager:
    def install(self, repo_root: Path, hook: LocalGitHookName) -> LocalGitHookChange:
        hook_path = git_hook_path(repo_root, hook)
        existing = read_text_if_present(hook_path)
        next_text = upsert_local_trigger_block(existing, local_trigger_block(hook))
        changed = next_text != existing
        if changed:
            hook_path.parent.mkdir(parents=True, exist_ok=True)
            hook_path.write_text(next_text, encoding="utf-8")
        ensure_executable(hook_path)
        return LocalGitHookChange(
            hook=hook,
            path=hook_path,
            changed=changed,
            installed=True,
            message=(
                f"installed {hook.value} local trigger hook"
                if changed
                else f"{hook.value} local trigger hook already installed"
            ),
        )

    def uninstall(self, repo_root: Path, hook: LocalGitHookName) -> LocalGitHookChange:
        hook_path = git_hook_path(repo_root, hook)
        existing = read_text_if_present(hook_path)
        next_text = remove_local_trigger_block(existing)
        changed = next_text != existing
        if changed:
            hook_path.write_text(next_text, encoding="utf-8")
        return LocalGitHookChange(
            hook=hook,
            path=hook_path,
            changed=changed,
            installed=False,
            message=(
                f"removed {hook.value} local trigger hook"
                if changed
                else f"{hook.value} local trigger hook was not installed"
            ),
        )


def git_hook_path(repo_root: Path, hook: LocalGitHookName) -> Path:
    completed = subprocess.run(
        ("git", "rev-parse", "--git-path", f"hooks/{hook.value}"),
        cwd=repo_root,
        text=True,
        capture_output=True,
        timeout=HOOK_TIMEOUT_SECONDS,
        check=False,
    )
    if completed.returncode != 0:
        message = first_line(completed.stderr, completed.stdout)
        raise ExecutionFailed(message or f"could not resolve Git hook path: {hook}")
    return (repo_root / completed.stdout.strip()).resolve()


def local_trigger_block(hook: LocalGitHookName) -> str:
    kind = TRIGGER_KIND_BY_HOOK[hook]
    return "\n".join(
        (
            LOCAL_TRIGGER_START,
            f"# {hook.value}: record CodeAlmanac branch trigger if configured.",
            'if command -v codealmanac >/dev/null 2>&1; then',
            '  _codealmanac_root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"',
            "  codealmanac __record-local-trigger \\",
            '    --cwd "$_codealmanac_root" \\',
            f"    --kind {kind} \\",
            "    --spawn-worker >/dev/null 2>&1 || true",
            "fi",
            LOCAL_TRIGGER_END,
            "",
        )
    )


def upsert_local_trigger_block(existing: str, block: str) -> str:
    base = existing if existing else "#!/bin/sh\n"
    without_block = remove_local_trigger_block(base).rstrip()
    return f"{without_block}\n\n{block}"


def remove_local_trigger_block(existing: str) -> str:
    start = existing.find(LOCAL_TRIGGER_START)
    if start == -1:
        return existing
    end = existing.find(LOCAL_TRIGGER_END, start)
    if end == -1:
        return existing
    end += len(LOCAL_TRIGGER_END)
    suffix = existing[end:]
    if suffix.startswith("\n"):
        suffix = suffix[1:]
    return f"{existing[:start].rstrip()}\n{suffix.lstrip()}".strip() + "\n"


def read_text_if_present(path: Path) -> str:
    if not path.is_file():
        return ""
    return path.read_text(encoding="utf-8")


def ensure_executable(path: Path) -> None:
    mode = path.stat().st_mode
    path.chmod(mode | stat.S_IXUSR)


def first_line(*values: str) -> str:
    for value in values:
        lines = [line.strip() for line in value.splitlines() if line.strip()]
        if lines:
            return lines[0]
    return ""
