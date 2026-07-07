import subprocess
from pathlib import Path

from codealmanac.core.errors import ExecutionFailed
from codealmanac.integrations.command import CommandRunner, SubprocessCommandRunner
from codealmanac.integrations.sources.runtime import (
    bounded_text,
    source_runtime_section,
    surface_process_error,
)
from codealmanac.services.sources.models import (
    SourceKind,
    SourceRef,
    SourceRuntime,
    SourceRuntimeStatus,
)
from codealmanac.services.sources.requests import InspectSourceRuntimeRequest

GIT_RUNTIME_TIMEOUT_SECONDS = 30
DEFAULT_MAX_CHARS = 60_000


class GitSourceRuntimeAdapter:
    def __init__(
        self,
        runner: CommandRunner | None = None,
        max_chars: int = DEFAULT_MAX_CHARS,
        timeout_seconds: int = GIT_RUNTIME_TIMEOUT_SECONDS,
    ):
        self.runner = runner or SubprocessCommandRunner()
        self.max_chars = max_chars
        self.timeout_seconds = timeout_seconds

    def supports(self, ref: SourceRef) -> bool:
        return ref.kind in {SourceKind.GIT_DIFF, SourceKind.GIT_RANGE}

    def inspect(self, request: InspectSourceRuntimeRequest) -> SourceRuntime:
        if request.ref.kind == SourceKind.GIT_RANGE:
            return self.inspect_range(request.cwd, request.ref)
        if request.ref.kind == SourceKind.GIT_DIFF:
            return self.inspect_diff(request.cwd, request.ref)
        return SourceRuntime(
            ref=request.ref,
            status=SourceRuntimeStatus.SKIPPED,
            title=f"Unsupported Git source {request.ref.identity}",
        )

    def inspect_range(self, cwd: Path, ref: SourceRef) -> SourceRuntime:
        revision_range = require_revision_range(ref)
        sections = (
            source_runtime_section(
                "commits",
                self.run_git(cwd, ("log", "--oneline", "--decorate", revision_range)),
            ),
            source_runtime_section(
                "stat",
                self.run_git(cwd, ("diff", "--stat", revision_range)),
            ),
            source_runtime_section(
                "diff",
                self.run_git(cwd, ("diff", "--no-ext-diff", revision_range)),
            ),
        )
        content, truncated = bounded_text("\n\n".join(sections), self.max_chars)
        return SourceRuntime(
            ref=ref,
            status=SourceRuntimeStatus.AVAILABLE,
            title=f"Git range {revision_range}",
            content=content,
            truncated=truncated,
        )

    def inspect_diff(self, cwd: Path, ref: SourceRef) -> SourceRuntime:
        target = require_revision_range(ref)
        if target == "working-tree":
            sections = (
                source_runtime_section(
                    "status",
                    self.run_git(cwd, ("status", "--short")),
                ),
                source_runtime_section(
                    "unstaged stat",
                    self.run_git(cwd, ("diff", "--stat")),
                ),
                source_runtime_section(
                    "unstaged diff",
                    self.run_git(cwd, ("diff", "--no-ext-diff")),
                ),
                source_runtime_section(
                    "staged stat",
                    self.run_git(cwd, ("diff", "--cached", "--stat")),
                ),
                source_runtime_section(
                    "staged diff",
                    self.run_git(cwd, ("diff", "--cached", "--no-ext-diff")),
                ),
            )
        else:
            sections = (
                source_runtime_section(
                    "stat",
                    self.run_git(cwd, ("diff", "--stat", target)),
                ),
                source_runtime_section(
                    "diff",
                    self.run_git(cwd, ("diff", "--no-ext-diff", target)),
                ),
            )
        content, truncated = bounded_text("\n\n".join(sections), self.max_chars)
        return SourceRuntime(
            ref=ref,
            status=SourceRuntimeStatus.AVAILABLE,
            title=f"Git diff {target}",
            content=content,
            truncated=truncated,
        )

    def run_git(self, cwd: Path, args: tuple[str, ...]) -> str:
        try:
            result = self.runner.run("git", args, cwd, self.timeout_seconds)
        except FileNotFoundError as error:
            raise ExecutionFailed("git not found on PATH") from error
        except subprocess.TimeoutExpired as error:
            raise ExecutionFailed(f"git {' '.join(args)} timed out") from error
        if result.returncode != 0:
            raise ExecutionFailed(
                f"git {' '.join(args)} failed: {surface_process_error(result)}"
            )
        return result.stdout.strip()


def require_revision_range(ref: SourceRef) -> str:
    if ref.revision_range is None or ref.revision_range.strip() == "":
        raise ExecutionFailed(f"Git source missing revision range: {ref.identity}")
    return ref.revision_range
