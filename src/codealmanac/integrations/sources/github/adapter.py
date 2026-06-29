import json
import subprocess
from pathlib import Path

from pydantic import BaseModel, ConfigDict, Field, ValidationError

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

GITHUB_RUNTIME_TIMEOUT_SECONDS = 30
DEFAULT_MAX_CHARS = 60_000
PULL_REQUEST_FIELDS = ",".join(
    (
        "title",
        "state",
        "author",
        "body",
        "url",
        "createdAt",
        "updatedAt",
        "mergedAt",
        "baseRefName",
        "headRefName",
        "commits",
        "files",
        "comments",
        "reviews",
    )
)
ISSUE_FIELDS = ",".join(
    (
        "title",
        "state",
        "author",
        "body",
        "url",
        "createdAt",
        "updatedAt",
        "closedAt",
        "labels",
        "assignees",
        "comments",
    )
)


class GitHubCliModel(BaseModel):
    model_config = ConfigDict(frozen=True, extra="ignore", populate_by_name=True)


class GitHubActor(GitHubCliModel):
    login: str
    name: str | None = None
    is_bot: bool | None = Field(default=None, alias="is_bot")


class GitHubLabel(GitHubCliModel):
    name: str
    description: str | None = None
    color: str | None = None


class GitHubComment(GitHubCliModel):
    author: GitHubActor | None = None
    body: str | None = None
    created_at: str | None = Field(default=None, alias="createdAt")
    url: str | None = None
    author_association: str | None = Field(default=None, alias="authorAssociation")
    is_minimized: bool | None = Field(default=None, alias="isMinimized")
    minimized_reason: str | None = Field(default=None, alias="minimizedReason")


class GitHubReview(GitHubCliModel):
    author: GitHubActor | None = None
    body: str | None = None
    state: str | None = None
    submitted_at: str | None = Field(default=None, alias="submittedAt")


class GitHubCommitAuthor(GitHubCliModel):
    name: str | None = None
    email: str | None = None
    login: str | None = None


class GitHubCommit(GitHubCliModel):
    oid: str
    message_headline: str | None = Field(default=None, alias="messageHeadline")
    message_body: str | None = Field(default=None, alias="messageBody")
    authored_date: str | None = Field(default=None, alias="authoredDate")
    committed_date: str | None = Field(default=None, alias="committedDate")
    authors: tuple[GitHubCommitAuthor, ...] = ()


class GitHubFile(GitHubCliModel):
    path: str
    additions: int = 0
    deletions: int = 0


class GitHubPullRequestPayload(GitHubCliModel):
    title: str
    state: str
    author: GitHubActor | None = None
    body: str | None = None
    url: str
    created_at: str | None = Field(default=None, alias="createdAt")
    updated_at: str | None = Field(default=None, alias="updatedAt")
    merged_at: str | None = Field(default=None, alias="mergedAt")
    base_ref_name: str | None = Field(default=None, alias="baseRefName")
    head_ref_name: str | None = Field(default=None, alias="headRefName")
    commits: tuple[GitHubCommit, ...] = ()
    files: tuple[GitHubFile, ...] = ()
    comments: tuple[GitHubComment, ...] = ()
    reviews: tuple[GitHubReview, ...] = ()


class GitHubIssuePayload(GitHubCliModel):
    title: str
    state: str
    author: GitHubActor | None = None
    body: str | None = None
    url: str
    created_at: str | None = Field(default=None, alias="createdAt")
    updated_at: str | None = Field(default=None, alias="updatedAt")
    closed_at: str | None = Field(default=None, alias="closedAt")
    labels: tuple[GitHubLabel, ...] = ()
    assignees: tuple[GitHubActor, ...] = ()
    comments: tuple[GitHubComment, ...] = ()


class GitHubSourceRuntimeAdapter:
    def __init__(
        self,
        runner: CommandRunner | None = None,
        max_chars: int = DEFAULT_MAX_CHARS,
        timeout_seconds: int = GITHUB_RUNTIME_TIMEOUT_SECONDS,
    ):
        self.runner = runner or SubprocessCommandRunner()
        self.max_chars = max_chars
        self.timeout_seconds = timeout_seconds

    def supports(self, ref: SourceRef) -> bool:
        return ref.kind in {
            SourceKind.GITHUB_PULL_REQUEST,
            SourceKind.GITHUB_ISSUE,
        }

    def inspect(self, request: InspectSourceRuntimeRequest) -> SourceRuntime:
        if request.ref.kind == SourceKind.GITHUB_PULL_REQUEST:
            return self._inspect_pull_request(request.cwd, request.ref)
        if request.ref.kind == SourceKind.GITHUB_ISSUE:
            return self._inspect_issue(request.cwd, request.ref)
        return SourceRuntime(
            ref=request.ref,
            status=SourceRuntimeStatus.SKIPPED,
            title=f"Unsupported GitHub source {request.ref.identity}",
        )

    def _inspect_pull_request(self, cwd: Path, ref: SourceRef) -> SourceRuntime:
        try:
            target_args = github_target_args(ref)
            payload = self._gh_json(
                cwd,
                ("pr", "view", *target_args, "--json", PULL_REQUEST_FIELDS),
                GitHubPullRequestPayload,
            )
            diff = self._gh_text(
                cwd,
                ("pr", "diff", *target_args, "--patch", "--color", "never"),
            )
        except (ExecutionFailed, ValidationError, json.JSONDecodeError) as error:
            return unavailable_runtime(ref, "GitHub pull request unavailable", error)

        content, truncated = bounded_text(
            "\n\n".join(
                (
                    source_runtime_section(
                        "metadata",
                        render_pull_request_metadata(payload),
                    ),
                    source_runtime_section("body", payload.body or ""),
                    source_runtime_section("files", render_files(payload.files)),
                    source_runtime_section("commits", render_commits(payload.commits)),
                    source_runtime_section(
                        "comments",
                        render_comments(payload.comments),
                    ),
                    source_runtime_section("reviews", render_reviews(payload.reviews)),
                    source_runtime_section("diff", diff),
                )
            ),
            self.max_chars,
        )
        return SourceRuntime(
            ref=ref,
            status=SourceRuntimeStatus.AVAILABLE,
            title=f"GitHub PR {payload.url}: {payload.title}",
            content=content,
            truncated=truncated,
        )

    def _inspect_issue(self, cwd: Path, ref: SourceRef) -> SourceRuntime:
        try:
            target_args = github_target_args(ref)
            payload = self._gh_json(
                cwd,
                ("issue", "view", *target_args, "--json", ISSUE_FIELDS),
                GitHubIssuePayload,
            )
        except (ExecutionFailed, ValidationError, json.JSONDecodeError) as error:
            return unavailable_runtime(ref, "GitHub issue unavailable", error)

        content, truncated = bounded_text(
            "\n\n".join(
                (
                    source_runtime_section("metadata", render_issue_metadata(payload)),
                    source_runtime_section("body", payload.body or ""),
                    source_runtime_section("labels", render_labels(payload.labels)),
                    source_runtime_section(
                        "assignees",
                        render_actors(payload.assignees),
                    ),
                    source_runtime_section(
                        "comments",
                        render_comments(payload.comments),
                    ),
                )
            ),
            self.max_chars,
        )
        return SourceRuntime(
            ref=ref,
            status=SourceRuntimeStatus.AVAILABLE,
            title=f"GitHub issue {payload.url}: {payload.title}",
            content=content,
            truncated=truncated,
        )

    def _gh_json(
        self,
        cwd: Path,
        args: tuple[str, ...],
        model: type[GitHubPullRequestPayload] | type[GitHubIssuePayload],
    ) -> GitHubPullRequestPayload | GitHubIssuePayload:
        return model.model_validate_json(self._gh_text(cwd, args))

    def _gh_text(self, cwd: Path, args: tuple[str, ...]) -> str:
        try:
            result = self.runner.run("gh", args, cwd, self.timeout_seconds)
        except FileNotFoundError as error:
            raise ExecutionFailed("gh not found on PATH") from error
        except subprocess.TimeoutExpired as error:
            raise ExecutionFailed(f"gh {' '.join(args)} timed out") from error
        if result.returncode != 0:
            raise ExecutionFailed(
                f"gh {' '.join(args)} failed: {surface_process_error(result)}"
            )
        return result.stdout.strip()


def github_target_args(ref: SourceRef) -> tuple[str, ...]:
    if ref.url is not None:
        return (ref.url,)
    if ref.number is None:
        raise ExecutionFailed(f"GitHub source missing number: {ref.identity}")
    if ref.repository is None:
        return (str(ref.number),)
    return (str(ref.number), "--repo", ref.repository)


def unavailable_runtime(
    ref: SourceRef,
    title: str,
    error: Exception,
) -> SourceRuntime:
    return SourceRuntime(
        ref=ref,
        status=SourceRuntimeStatus.UNAVAILABLE,
        title=title,
        diagnostics=(first_error_line(error),),
    )


def first_error_line(error: Exception) -> str:
    lines = [line.strip() for line in str(error).splitlines() if line.strip()]
    if not lines:
        return error.__class__.__name__
    return lines[0]


def render_pull_request_metadata(payload: GitHubPullRequestPayload) -> str:
    lines = [
        f"title: {payload.title}",
        f"state: {payload.state}",
        f"url: {payload.url}",
        f"author: {render_actor(payload.author)}",
        f"base: {payload.base_ref_name or '(unknown)'}",
        f"head: {payload.head_ref_name or '(unknown)'}",
        f"created_at: {payload.created_at or '(unknown)'}",
        f"updated_at: {payload.updated_at or '(unknown)'}",
    ]
    if payload.merged_at is not None:
        lines.append(f"merged_at: {payload.merged_at}")
    return "\n".join(lines)


def render_issue_metadata(payload: GitHubIssuePayload) -> str:
    lines = [
        f"title: {payload.title}",
        f"state: {payload.state}",
        f"url: {payload.url}",
        f"author: {render_actor(payload.author)}",
        f"created_at: {payload.created_at or '(unknown)'}",
        f"updated_at: {payload.updated_at or '(unknown)'}",
    ]
    if payload.closed_at is not None:
        lines.append(f"closed_at: {payload.closed_at}")
    return "\n".join(lines)


def render_files(files: tuple[GitHubFile, ...]) -> str:
    if len(files) == 0:
        return ""
    return "\n".join(
        f"- {file.path} (+{file.additions}/-{file.deletions})" for file in files
    )


def render_commits(commits: tuple[GitHubCommit, ...]) -> str:
    if len(commits) == 0:
        return ""
    blocks: list[str] = []
    for commit in commits:
        header = commit.oid
        if commit.message_headline:
            header = f"{header} {commit.message_headline}"
        body = (commit.message_body or "").strip()
        if body:
            blocks.append(f"- {header}\n{body}")
        else:
            blocks.append(f"- {header}")
    return "\n".join(blocks)


def render_comments(comments: tuple[GitHubComment, ...]) -> str:
    if len(comments) == 0:
        return ""
    blocks: list[str] = []
    for comment in comments:
        header = f"### {render_actor(comment.author)}"
        if comment.created_at is not None:
            header = f"{header} at {comment.created_at}"
        flags = render_comment_flags(comment)
        if flags:
            header = f"{header} ({flags})"
        blocks.append(f"{header}\n{(comment.body or '').strip()}")
    return "\n\n".join(blocks)


def render_comment_flags(comment: GitHubComment) -> str:
    flags: list[str] = []
    if comment.author_association:
        flags.append(f"association={comment.author_association}")
    if comment.is_minimized is True:
        reason = comment.minimized_reason or "unknown"
        flags.append(f"minimized={reason}")
    return ", ".join(flags)


def render_reviews(reviews: tuple[GitHubReview, ...]) -> str:
    if len(reviews) == 0:
        return ""
    blocks: list[str] = []
    for review in reviews:
        state = review.state or "UNKNOWN"
        header = f"### {state} by {render_actor(review.author)}"
        if review.submitted_at is not None:
            header = f"{header} at {review.submitted_at}"
        blocks.append(f"{header}\n{(review.body or '').strip()}")
    return "\n\n".join(blocks)


def render_labels(labels: tuple[GitHubLabel, ...]) -> str:
    if len(labels) == 0:
        return ""
    return "\n".join(f"- {label.name}" for label in labels)


def render_actors(actors: tuple[GitHubActor, ...]) -> str:
    if len(actors) == 0:
        return ""
    return "\n".join(f"- {render_actor(actor)}" for actor in actors)


def render_actor(actor: GitHubActor | None) -> str:
    if actor is None:
        return "unknown"
    if actor.name:
        return f"{actor.login} ({actor.name})"
    return actor.login
