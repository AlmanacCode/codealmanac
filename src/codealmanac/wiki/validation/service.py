from pathlib import Path

import frontmatter
import yaml as pyyaml
from pydantic import ValidationError
from yaml import YAMLError
from yaml.error import MarkedYAMLError

from codealmanac.core.errors import ValidationFailed
from codealmanac.wiki.frontmatter import FrontmatterFields
from codealmanac.wiki.topic_models import TopicsYaml
from codealmanac.wiki.validation.models import (
    WikiValidationIssue,
    WikiValidationIssueKind,
    WikiValidationReport,
)
from codealmanac.wiki.validation.requests import ValidateWikiRequest
from codealmanac.wiki.workspaces.models import Workspace
from codealmanac.wiki.workspaces.requests import SelectWorkspaceRequest
from codealmanac.wiki.workspaces.service import WorkspacesService


class ValidationService:
    def __init__(self, workspaces: WorkspacesService):
        self.workspaces = workspaces

    def check(self, request: ValidateWikiRequest) -> WikiValidationReport:
        if request.wiki is None:
            workspace = self.workspaces.resolve(request.cwd)
        else:
            workspace = self.workspaces.select(
                SelectWorkspaceRequest(selector=request.wiki, base_path=request.cwd)
            )
        return self.check_workspace(workspace)

    def check_workspace(self, workspace: Workspace) -> WikiValidationReport:
        return self.check_root(workspace.root_path, workspace.almanac_path)

    def check_root(self, repo_root: Path, almanac_path: Path) -> WikiValidationReport:
        issues: list[WikiValidationIssue] = []
        pages_checked = 0
        if not almanac_path.is_dir():
            issues.append(
                issue(
                    repo_root,
                    almanac_path,
                    WikiValidationIssueKind.STRUCTURE,
                    "Almanac root is missing.",
                )
            )
            return report(almanac_path, pages_checked, issues)

        topics_path = almanac_path / "topics.yaml"
        pages_path = almanac_path / "pages"
        if not topics_path.is_file():
            issues.append(
                issue(
                    repo_root,
                    topics_path,
                    WikiValidationIssueKind.STRUCTURE,
                    "topics.yaml is missing.",
                )
            )
        else:
            issues.extend(validate_topics(repo_root, topics_path))

        if not pages_path.is_dir():
            issues.append(
                issue(
                    repo_root,
                    pages_path,
                    WikiValidationIssueKind.STRUCTURE,
                    "pages directory is missing.",
                )
            )
            return report(almanac_path, pages_checked, issues)

        for page_path in sorted(pages_path.rglob("*.md")):
            pages_checked += 1
            issues.extend(validate_page(repo_root, page_path))
        return report(almanac_path, pages_checked, issues)

    def require_valid(self, validation: WikiValidationReport) -> None:
        if validation.ok:
            return
        raise ValidationFailed(validation_failure_message(validation))

    def require_valid_workspace(self, workspace: Workspace) -> WikiValidationReport:
        validation = self.check_workspace(workspace)
        self.require_valid(validation)
        return validation

    def require_valid_root(
        self,
        repo_root: Path,
        almanac_path: Path,
    ) -> WikiValidationReport:
        validation = self.check_root(repo_root, almanac_path)
        self.require_valid(validation)
        return validation


def validate_topics(repo_root: Path, path: Path) -> tuple[WikiValidationIssue, ...]:
    try:
        raw = path.read_text(encoding="utf-8")
    except OSError as error:
        return (issue(repo_root, path, WikiValidationIssueKind.READ, str(error)),)
    try:
        parsed = pyyaml.safe_load(raw) or {}
    except YAMLError as error:
        return (yaml_issue(repo_root, path, WikiValidationIssueKind.TOPICS, error),)
    if not isinstance(parsed, dict):
        return (
            issue(
                repo_root,
                path,
                WikiValidationIssueKind.TOPICS,
                "topics.yaml must contain a mapping.",
            ),
        )
    try:
        TopicsYaml.model_validate(parsed)
    except ValidationError as error:
        return (
            issue(
                repo_root,
                path,
                WikiValidationIssueKind.TOPICS,
                pydantic_message(error),
            ),
        )
    return ()


def validate_page(repo_root: Path, path: Path) -> tuple[WikiValidationIssue, ...]:
    try:
        raw = path.read_text(encoding="utf-8")
    except OSError as error:
        return (issue(repo_root, path, WikiValidationIssueKind.READ, str(error)),)
    try:
        post = frontmatter.loads(raw)
        FrontmatterFields.model_validate(post.metadata)
    except YAMLError as error:
        return (
            yaml_issue(repo_root, path, WikiValidationIssueKind.FRONTMATTER, error),
        )
    except (ValueError, ValidationError) as error:
        return (
            issue(
                repo_root,
                path,
                WikiValidationIssueKind.FRONTMATTER,
                validation_message(error),
            ),
        )
    return ()


def report(
    almanac_path: Path,
    pages_checked: int,
    issues: list[WikiValidationIssue],
) -> WikiValidationReport:
    return WikiValidationReport(
        ok=len(issues) == 0,
        almanac_root=almanac_path,
        pages_checked=pages_checked,
        issues=tuple(issues),
    )


def issue(
    repo_root: Path,
    path: Path,
    kind: WikiValidationIssueKind,
    message: str,
    *,
    line: int | None = None,
    column: int | None = None,
) -> WikiValidationIssue:
    return WikiValidationIssue(
        kind=kind,
        path=relative_path(repo_root, path),
        message=message,
        line=line,
        column=column,
    )


def yaml_issue(
    repo_root: Path,
    path: Path,
    kind: WikiValidationIssueKind,
    error: YAMLError,
) -> WikiValidationIssue:
    mark = error.problem_mark if isinstance(error, MarkedYAMLError) else None
    line = mark.line + 1 if mark is not None else None
    column = mark.column + 1 if mark is not None else None
    return issue(
        repo_root,
        path,
        kind,
        first_line(str(error)) or error.__class__.__name__,
        line=line,
        column=column,
    )


def validation_message(error: ValueError | ValidationError) -> str:
    if isinstance(error, ValidationError):
        return pydantic_message(error)
    return first_line(str(error)) or error.__class__.__name__


def pydantic_message(error: ValidationError) -> str:
    errors = error.errors()
    if len(errors) == 0:
        return first_line(str(error)) or error.__class__.__name__
    first = errors[0]
    location = ".".join(str(part) for part in first["loc"])
    prefix = f"{location}: " if location else ""
    return f"{prefix}{first['msg']}"


def validation_failure_message(validation: WikiValidationReport) -> str:
    first = validation.issues[0]
    suffix = (
        ""
        if len(validation.issues) == 1
        else f" (+{len(validation.issues) - 1} more)"
    )
    return f"wiki validation failed: {format_issue(first)}{suffix}"


def format_issue(issue: WikiValidationIssue) -> str:
    location = issue.path.as_posix()
    if issue.line is not None:
        location = f"{location}:{issue.line}"
        if issue.column is not None:
            location = f"{location}:{issue.column}"
    return f"{location}: {issue.message}"


def relative_path(repo_root: Path, path: Path) -> Path:
    try:
        return path.relative_to(repo_root)
    except ValueError:
        return path


def first_line(value: str) -> str:
    return value.splitlines()[0] if value.splitlines() else value
