from codealmanac.engine.sources.models import (
    SourceRef,
    SourceRuntime,
    SourceRuntimeStatus,
)
from codealmanac.integrations.sources.github.models import (
    GitHubActor,
    GitHubComment,
    GitHubCommit,
    GitHubFile,
    GitHubIssuePayload,
    GitHubLabel,
    GitHubPullRequestPayload,
    GitHubReview,
)
from codealmanac.integrations.sources.runtime import (
    bounded_text,
    source_runtime_section,
)


def render_pull_request_runtime(
    ref: SourceRef,
    payload: GitHubPullRequestPayload,
    diff: str,
    max_chars: int,
) -> SourceRuntime:
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
                source_runtime_section("comments", render_comments(payload.comments)),
                source_runtime_section("reviews", render_reviews(payload.reviews)),
                source_runtime_section("diff", diff),
            )
        ),
        max_chars,
    )
    return SourceRuntime(
        ref=ref,
        status=SourceRuntimeStatus.AVAILABLE,
        title=f"GitHub PR {payload.url}: {payload.title}",
        content=content,
        truncated=truncated,
    )


def render_issue_runtime(
    ref: SourceRef,
    payload: GitHubIssuePayload,
    max_chars: int,
) -> SourceRuntime:
    content, truncated = bounded_text(
        "\n\n".join(
            (
                source_runtime_section("metadata", render_issue_metadata(payload)),
                source_runtime_section("body", payload.body or ""),
                source_runtime_section("labels", render_labels(payload.labels)),
                source_runtime_section("assignees", render_actors(payload.assignees)),
                source_runtime_section("comments", render_comments(payload.comments)),
            )
        ),
        max_chars,
    )
    return SourceRuntime(
        ref=ref,
        status=SourceRuntimeStatus.AVAILABLE,
        title=f"GitHub issue {payload.url}: {payload.title}",
        content=content,
        truncated=truncated,
    )


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
