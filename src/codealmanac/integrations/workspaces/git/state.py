import subprocess
from pathlib import Path

from codealmanac.core.paths import normalize_path
from codealmanac.services.control.models import LocalGitState

GIT_STATE_TIMEOUT_SECONDS = 10


class GitLocalStateProbe:
    def read(self, cwd: Path) -> LocalGitState:
        normalized = normalize_path(cwd)
        root = run_git(normalized, ("rev-parse", "--show-toplevel"))
        if root.returncode != 0:
            return unavailable_state(normalized, first_line(root.stderr, root.stdout))
        repository_root = normalize_path(Path(root.stdout.strip()))

        branch = run_git(repository_root, ("branch", "--show-current"))
        if branch.returncode != 0:
            return unavailable_state(
                normalized,
                first_line(branch.stderr, branch.stdout),
            )
        branch_name = branch.stdout.strip()
        if branch_name == "":
            return unavailable_state(normalized, "detached HEAD has no branch")

        head = run_git(repository_root, ("rev-parse", "HEAD"))
        if head.returncode != 0:
            return unavailable_state(normalized, first_line(head.stderr, head.stdout))
        head_sha = head.stdout.strip()
        if head_sha == "":
            return unavailable_state(normalized, "git HEAD is empty")

        return LocalGitState(
            cwd=normalized,
            available=True,
            repository_root=repository_root,
            branch_name=branch_name,
            head_sha=head_sha,
        )


def run_git(cwd: Path, args: tuple[str, ...]) -> subprocess.CompletedProcess[str]:
    try:
        return subprocess.run(
            ("git", *args),
            cwd=cwd,
            text=True,
            capture_output=True,
            timeout=GIT_STATE_TIMEOUT_SECONDS,
            check=False,
        )
    except FileNotFoundError as error:
        return subprocess.CompletedProcess(
            ("git", *args),
            127,
            "",
            str(error),
        )
    except subprocess.TimeoutExpired as error:
        return subprocess.CompletedProcess(
            ("git", *args),
            124,
            error.stdout or "",
            "git command timed out",
        )


def unavailable_state(cwd: Path, reason: str) -> LocalGitState:
    return LocalGitState(
        cwd=cwd,
        available=False,
        unavailable_reason=reason or "git state unavailable",
    )


def first_line(*values: str) -> str:
    for value in values:
        lines = [line.strip() for line in value.splitlines() if line.strip()]
        if lines:
            return lines[0]
    return ""
