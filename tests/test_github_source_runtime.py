from pathlib import Path

from codealmanac.app import create_app
from codealmanac.integrations.command import CommandResult
from codealmanac.integrations.sources.github import GitHubSourceRuntimeAdapter
from codealmanac.services.sources.models import SourceRuntimeStatus
from codealmanac.services.sources.requests import (
    InspectSourceRuntimeRequest,
    ResolveSourcesRequest,
)


class FakeGhRunner:
    def __init__(self, failures: dict[tuple[str, ...], CommandResult] | None = None):
        self.calls: list[tuple[str, tuple[str, ...], Path]] = []
        self.failures = failures or {}

    def run(
        self,
        command: str,
        args: tuple[str, ...],
        cwd: Path,
        timeout_seconds: int,
        stdin: str | None = None,
    ) -> CommandResult:
        self.calls.append((command, args, cwd))
        if args in self.failures:
            return self.failures[args]
        if args[:2] == ("pr", "view"):
            return CommandResult(returncode=0, stdout=PULL_REQUEST_JSON, stderr="")
        if args[:2] == ("pr", "diff"):
            return CommandResult(returncode=0, stdout=PULL_REQUEST_DIFF, stderr="")
        if args[:2] == ("issue", "view"):
            return CommandResult(returncode=0, stdout=ISSUE_JSON, stderr="")
        return CommandResult(returncode=1, stdout="", stderr="unexpected gh call")


PULL_REQUEST_JSON = """{
  "title": "Keep auth decisions in the wiki",
  "state": "OPEN",
  "author": {"login": "rohan", "name": "Rohan"},
  "body": "This PR preserves the auth decision history.",
  "url": "https://github.com/acme/project/pull/42",
  "createdAt": "2026-06-28T10:00:00Z",
  "updatedAt": "2026-06-29T10:00:00Z",
  "mergedAt": null,
  "baseRefName": "main",
  "headRefName": "auth-wiki",
  "files": [{"path": "src/auth.py", "additions": 8, "deletions": 2}],
  "commits": [{
    "oid": "abc123",
    "messageHeadline": "document auth flow",
    "messageBody": "Keeps reusable context available.",
    "authoredDate": "2026-06-28T10:00:00Z",
    "committedDate": "2026-06-28T10:01:00Z",
    "authors": [{"name": "Rohan", "email": "rohan@example.com"}]
  }],
  "comments": [{
    "author": {"login": "kushagra"},
    "body": "Keep the previous failed approach in the page.",
    "createdAt": "2026-06-28T11:00:00Z",
    "url": "https://github.com/acme/project/pull/42#issuecomment-1",
    "authorAssociation": "MEMBER",
    "isMinimized": false
  }],
  "reviews": [{
    "author": {"login": "reviewer"},
    "body": "Needs the invariant named explicitly.",
    "state": "COMMENTED",
    "submittedAt": "2026-06-28T12:00:00Z"
  }]
}"""
PULL_REQUEST_DIFF = """diff --git a/src/auth.py b/src/auth.py
+AUTH_DECISION = "wiki records why"
"""
ISSUE_JSON = """{
  "title": "Track deployment constraints",
  "state": "OPEN",
  "author": {"login": "rohan"},
  "body": "The wiki should preserve deployment gotchas.",
  "url": "https://github.com/acme/project/issues/7",
  "createdAt": "2026-06-27T10:00:00Z",
  "updatedAt": "2026-06-29T10:00:00Z",
  "closedAt": null,
  "labels": [{"name": "docs"}, {"name": "deploy"}],
  "assignees": [{"login": "kushagra"}],
  "comments": [{
    "author": {"login": "rohan"},
    "body": "This came from a production deploy.",
    "createdAt": "2026-06-27T11:00:00Z"
  }]
}"""


def test_github_source_runtime_loads_pull_request_url(tmp_path: Path):
    runner = FakeGhRunner()
    app = create_app(source_runtime_adapters=(GitHubSourceRuntimeAdapter(runner),))
    (brief,) = app.sources.resolve(
        ResolveSourcesRequest(
            cwd=tmp_path,
            inputs=("https://github.com/acme/project/pull/42",),
        )
    )

    runtime = app.sources.inspect_runtime(
        InspectSourceRuntimeRequest(cwd=tmp_path, ref=brief.ref)
    )

    assert runtime.status == SourceRuntimeStatus.AVAILABLE
    assert runtime.title == (
        "GitHub PR https://github.com/acme/project/pull/42: "
        "Keep auth decisions in the wiki"
    )
    assert "src/auth.py (+8/-2)" in (runtime.content or "")
    assert "Keep the previous failed approach" in (runtime.content or "")
    assert "Needs the invariant named explicitly" in (runtime.content or "")
    assert "diff --git a/src/auth.py b/src/auth.py" in (runtime.content or "")
    assert (
        "gh",
        (
            "pr",
            "view",
            "https://github.com/acme/project/pull/42",
            "--json",
            (
                "title,state,author,body,url,createdAt,updatedAt,mergedAt,"
                "baseRefName,headRefName,commits,files,comments,reviews"
            ),
        ),
        tmp_path,
    ) in runner.calls


def test_github_source_runtime_loads_issue_shorthand(tmp_path: Path):
    runner = FakeGhRunner()
    app = create_app(source_runtime_adapters=(GitHubSourceRuntimeAdapter(runner),))
    (brief,) = app.sources.resolve(
        ResolveSourcesRequest(cwd=tmp_path, inputs=("github:issue:7",))
    )

    runtime = app.sources.inspect_runtime(
        InspectSourceRuntimeRequest(cwd=tmp_path, ref=brief.ref)
    )

    assert runtime.status == SourceRuntimeStatus.AVAILABLE
    assert "Track deployment constraints" in runtime.title
    assert "The wiki should preserve deployment gotchas." in (runtime.content or "")
    assert "- docs" in (runtime.content or "")
    assert "- kushagra" in (runtime.content or "")
    assert ("gh", ("issue", "view", "7", "--json", (
        "title,state,author,body,url,createdAt,updatedAt,closedAt,"
        "labels,assignees,comments"
    )), tmp_path) in runner.calls


def test_github_source_runtime_marks_cli_failures_unavailable(tmp_path: Path):
    failure_args = (
        "pr",
        "view",
        "42",
        "--json",
        (
            "title,state,author,body,url,createdAt,updatedAt,mergedAt,"
            "baseRefName,headRefName,commits,files,comments,reviews"
        ),
    )
    runner = FakeGhRunner(
        failures={
            failure_args: CommandResult(
                returncode=4,
                stdout="",
                stderr="gh auth required",
            )
        }
    )
    app = create_app(source_runtime_adapters=(GitHubSourceRuntimeAdapter(runner),))
    (brief,) = app.sources.resolve(
        ResolveSourcesRequest(cwd=tmp_path, inputs=("github:pr:42",))
    )

    runtime = app.sources.inspect_runtime(
        InspectSourceRuntimeRequest(cwd=tmp_path, ref=brief.ref)
    )

    assert runtime.status == SourceRuntimeStatus.UNAVAILABLE
    assert runtime.content is None
    assert runtime.diagnostics == (
        "gh pr view 42 --json title,state,author,body,url,createdAt,updatedAt,"
        "mergedAt,baseRefName,headRefName,commits,files,comments,reviews failed: "
        "gh auth required",
    )
