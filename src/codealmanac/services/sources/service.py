from hashlib import sha256
from pathlib import Path
from urllib.parse import urlsplit

from pydantic import AnyHttpUrl, TypeAdapter, ValidationError

from codealmanac.core.errors import ValidationFailed
from codealmanac.core.paths import normalize_path
from codealmanac.services.sources.models import (
    SourceAddress,
    SourceBrief,
    SourceKind,
    SourceProvenanceKind,
    SourceRef,
)
from codealmanac.services.sources.requests import ResolveSourcesRequest

PULL_REQUEST_PROMPT_HINT = (
    "Inspect the pull request, diff, commits, reviews, and linked issues before "
    "deciding whether durable wiki knowledge changed."
)
ISSUE_PROMPT_HINT = (
    "Inspect the issue, linked pull requests, decisions, labels, and comments "
    "before deciding whether durable wiki knowledge changed."
)
GIT_RANGE_PROMPT_HINT = (
    "Inspect the commit range and changed files before deciding whether durable "
    "wiki knowledge changed."
)
GIT_DIFF_PROMPT_HINT = (
    "Inspect the diff and current files before deciding whether durable wiki "
    "knowledge changed."
)
WEB_PROMPT_HINT = (
    "Inspect the web page as source material before deciding whether durable "
    "wiki knowledge changed."
)
DIRECTORY_PROMPT_HINT = (
    "Inspect the directory as bounded local source material before deciding "
    "whether durable wiki knowledge changed."
)
FILE_PROMPT_HINT = (
    "Inspect the file as bounded local source material before deciding whether "
    "durable wiki knowledge changed."
)
MISSING_PATH_PROMPT_HINT = (
    "Resolve the missing local path before attempting to use it as source "
    "material."
)

HTTP_URL_ADAPTER = TypeAdapter(AnyHttpUrl)


class SourcesService:
    def resolve(self, request: ResolveSourcesRequest) -> tuple[SourceBrief, ...]:
        return tuple(
            resolve_address(SourceAddress(raw=raw), request.cwd)
            for raw in request.inputs
        )


def resolve_address(address: SourceAddress, cwd: Path) -> SourceBrief:
    raw = address.raw
    if raw.startswith("github:"):
        return resolve_github_shorthand(raw)
    if raw.startswith("git:range:"):
        return resolve_git_range(raw)
    if raw == "git:diff" or raw.startswith("git:diff:"):
        return resolve_git_diff(raw)
    if raw.startswith("transcript:"):
        return resolve_transcript(raw)
    parsed = urlsplit(raw)
    if parsed.scheme in {"http", "https"}:
        return resolve_url(raw)
    return resolve_path(raw, cwd)


def resolve_github_shorthand(raw: str) -> SourceBrief:
    parts = raw.split(":")
    if len(parts) != 3:
        raise ValidationFailed(f"invalid GitHub source address: {raw}")
    _, source_type, number_text = parts
    number = parse_positive_int(number_text, raw)
    if source_type == "pr":
        ref = SourceRef(
            raw=raw,
            kind=SourceKind.GITHUB_PULL_REQUEST,
            identity=f"github.pull_request:{number}",
            number=number,
        )
        return SourceBrief(
            ref=ref,
            title=f"GitHub pull request #{number}",
            provenance_kind=SourceProvenanceKind.PR,
            prompt_hint=PULL_REQUEST_PROMPT_HINT,
        )
    if source_type == "issue":
        ref = SourceRef(
            raw=raw,
            kind=SourceKind.GITHUB_ISSUE,
            identity=f"github.issue:{number}",
            number=number,
        )
        return SourceBrief(
            ref=ref,
            title=f"GitHub issue #{number}",
            provenance_kind=SourceProvenanceKind.ISSUE,
            prompt_hint=ISSUE_PROMPT_HINT,
        )
    raise ValidationFailed(f"unsupported GitHub source address: {raw}")


def resolve_git_range(raw: str) -> SourceBrief:
    revision_range = raw.removeprefix("git:range:").strip()
    if not revision_range:
        raise ValidationFailed("git range source requires a revision range")
    ref = SourceRef(
        raw=raw,
        kind=SourceKind.GIT_RANGE,
        identity=f"git.range:{revision_range}",
        revision_range=revision_range,
    )
    return SourceBrief(
        ref=ref,
        title=f"Git range {revision_range}",
        provenance_kind=SourceProvenanceKind.GIT,
        prompt_hint=GIT_RANGE_PROMPT_HINT,
    )


def resolve_git_diff(raw: str) -> SourceBrief:
    target = raw.removeprefix("git:diff").removeprefix(":").strip() or "working-tree"
    ref = SourceRef(
        raw=raw,
        kind=SourceKind.GIT_DIFF,
        identity=f"git.diff:{target}",
        revision_range=target,
    )
    return SourceBrief(
        ref=ref,
        title=f"Git diff {target}",
        provenance_kind=SourceProvenanceKind.GIT,
        prompt_hint=GIT_DIFF_PROMPT_HINT,
    )


def resolve_transcript(raw: str) -> SourceBrief:
    transcript = raw.removeprefix("transcript:").strip()
    if not transcript:
        raise ValidationFailed("transcript source requires an identifier or path")
    ref = SourceRef(
        raw=raw,
        kind=SourceKind.TRANSCRIPT,
        identity=f"transcript:{transcript}",
        transcript=transcript,
    )
    return SourceBrief(
        ref=ref,
        title=f"Transcript {transcript}",
        provenance_kind=SourceProvenanceKind.TRANSCRIPT,
        prompt_hint=(
            "Inspect the transcript structurally and preserve only reusable "
            "project knowledge."
        ),
    )


def resolve_url(raw: str) -> SourceBrief:
    url = normalize_http_url(raw)
    github = parse_github_url(raw, url)
    if github is not None:
        return github
    ref = SourceRef(
        raw=raw,
        kind=SourceKind.WEB_URL,
        identity=url,
        url=url,
    )
    return SourceBrief(
        ref=ref,
        title=url,
        provenance_kind=SourceProvenanceKind.URL,
        prompt_hint=WEB_PROMPT_HINT,
    )


def normalize_http_url(raw: str) -> str:
    parsed = urlsplit(raw)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValidationFailed(f"invalid URL source address: {raw}")
    try:
        return str(HTTP_URL_ADAPTER.validate_python(raw))
    except ValidationError as error:
        raise ValidationFailed(f"invalid URL source address: {raw}") from error


def parse_github_url(raw: str, url: str) -> SourceBrief | None:
    parsed = urlsplit(url)
    if parsed.netloc.casefold() != "github.com":
        return None
    parts = [part for part in parsed.path.split("/") if part]
    if len(parts) < 4:
        return None
    owner, repo, source_type, number_text = parts[:4]
    if source_type not in {"pull", "issues"}:
        return None
    number = parse_positive_int(number_text, raw)
    repository = f"{owner}/{repo}"
    if source_type == "pull":
        url = f"https://github.com/{repository}/pull/{number}"
        ref = SourceRef(
            raw=raw,
            kind=SourceKind.GITHUB_PULL_REQUEST,
            identity=f"github.pull_request:{repository}#{number}",
            url=url,
            repository=repository,
            number=number,
        )
        return SourceBrief(
            ref=ref,
            title=f"{repository} pull request #{number}",
            provenance_kind=SourceProvenanceKind.PR,
            prompt_hint=PULL_REQUEST_PROMPT_HINT,
        )
    url = f"https://github.com/{repository}/issues/{number}"
    ref = SourceRef(
        raw=raw,
        kind=SourceKind.GITHUB_ISSUE,
        identity=f"github.issue:{repository}#{number}",
        url=url,
        repository=repository,
        number=number,
    )
    return SourceBrief(
        ref=ref,
        title=f"{repository} issue #{number}",
        provenance_kind=SourceProvenanceKind.ISSUE,
        prompt_hint=ISSUE_PROMPT_HINT,
    )


def resolve_path(raw: str, cwd: Path) -> SourceBrief:
    path = resolve_user_path(raw, cwd)
    if path.is_dir():
        kind = SourceKind.PATH_DIRECTORY
        provenance_kind = SourceProvenanceKind.DIRECTORY
        title = f"Directory {path}"
        prompt_hint = DIRECTORY_PROMPT_HINT
        fingerprint = None
    elif path.is_file():
        kind = SourceKind.PATH_FILE
        provenance_kind = SourceProvenanceKind.FILE
        title = f"File {path}"
        prompt_hint = FILE_PROMPT_HINT
        fingerprint = file_fingerprint(path)
    else:
        kind = SourceKind.PATH_UNKNOWN
        provenance_kind = SourceProvenanceKind.MISSING_PATH
        title = f"Missing path {path}"
        prompt_hint = MISSING_PATH_PROMPT_HINT
        fingerprint = None
    ref = SourceRef(
        raw=raw,
        kind=kind,
        identity=f"{kind.value}:{path}",
        path=path,
        exists=path.exists(),
        fingerprint=fingerprint,
    )
    return SourceBrief(
        ref=ref,
        title=title,
        provenance_kind=provenance_kind,
        prompt_hint=prompt_hint,
    )


def resolve_user_path(raw: str, cwd: Path) -> Path:
    path = Path(raw).expanduser()
    if not path.is_absolute():
        path = cwd / path
    return normalize_path(path)


def file_fingerprint(path: Path) -> str | None:
    try:
        return sha256(path.read_bytes()).hexdigest()
    except OSError:
        return None


def parse_positive_int(value: str, raw: str) -> int:
    try:
        parsed = int(value)
    except ValueError as error:
        raise ValidationFailed(f"source number must be positive: {raw}") from error
    if parsed < 1:
        raise ValidationFailed(f"source number must be positive: {raw}")
    return parsed
