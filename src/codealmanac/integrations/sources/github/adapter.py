import json
from pathlib import Path

from pydantic import ValidationError

from codealmanac.core.errors import ExecutionFailed
from codealmanac.integrations.command import CommandRunner
from codealmanac.integrations.sources.github.client import (
    GITHUB_RUNTIME_TIMEOUT_SECONDS,
    GitHubClient,
)
from codealmanac.integrations.sources.github.errors import unavailable_runtime
from codealmanac.integrations.sources.github.rendering import (
    render_issue_runtime,
    render_pull_request_runtime,
)
from codealmanac.services.sources.models import (
    SourceKind,
    SourceRef,
    SourceRuntime,
    SourceRuntimeStatus,
)
from codealmanac.services.sources.requests import InspectSourceRuntimeRequest

DEFAULT_MAX_CHARS = 60_000


class GitHubSourceRuntimeAdapter:
    def __init__(
        self,
        runner: CommandRunner | None = None,
        max_chars: int = DEFAULT_MAX_CHARS,
        timeout_seconds: int = GITHUB_RUNTIME_TIMEOUT_SECONDS,
    ):
        self.client = GitHubClient(runner, timeout_seconds)
        self.max_chars = max_chars

    def supports(self, ref: SourceRef) -> bool:
        return ref.kind in {
            SourceKind.GITHUB_PULL_REQUEST,
            SourceKind.GITHUB_ISSUE,
        }

    def inspect(self, request: InspectSourceRuntimeRequest) -> SourceRuntime:
        if request.ref.kind == SourceKind.GITHUB_PULL_REQUEST:
            return self.inspect_pull_request(request.cwd, request.ref)
        if request.ref.kind == SourceKind.GITHUB_ISSUE:
            return self.inspect_issue(request.cwd, request.ref)
        return SourceRuntime(
            ref=request.ref,
            status=SourceRuntimeStatus.SKIPPED,
            title=f"Unsupported GitHub source {request.ref.identity}",
        )

    def inspect_pull_request(self, cwd: Path, ref: SourceRef) -> SourceRuntime:
        try:
            payload, diff = self.client.pull_request(cwd, ref)
        except (ExecutionFailed, ValidationError, json.JSONDecodeError) as error:
            return unavailable_runtime(ref, "GitHub pull request unavailable", error)
        return render_pull_request_runtime(ref, payload, diff, self.max_chars)

    def inspect_issue(self, cwd: Path, ref: SourceRef) -> SourceRuntime:
        try:
            payload = self.client.issue(cwd, ref)
        except (ExecutionFailed, ValidationError, json.JSONDecodeError) as error:
            return unavailable_runtime(ref, "GitHub issue unavailable", error)
        return render_issue_runtime(ref, payload, self.max_chars)
