import json
from datetime import UTC, datetime
from pathlib import Path

from codealmanac.core.paths import normalize_path
from codealmanac.services.sources.models import TranscriptApp, TranscriptCandidate
from codealmanac.wiki.workspaces.roots import nearest_almanac_root


def collect_jsonl(root: Path) -> tuple[Path, ...]:
    if not root.is_dir():
        return ()
    return tuple(sorted(path for path in root.rglob("*.jsonl") if path.is_file()))


def read_first_lines(path: Path, max_lines: int) -> tuple[str, ...]:
    try:
        with path.open("r", encoding="utf-8") as file:
            lines = []
            for _ in range(max_lines):
                line = file.readline()
                if line == "":
                    break
                lines.append(line.rstrip("\r\n"))
            return tuple(lines)
    except OSError:
        return ()


def parse_json_object(line: str) -> dict[str, object] | None:
    if not line.strip():
        return None
    try:
        parsed = json.loads(line)
    except ValueError:
        return None
    if isinstance(parsed, dict):
        return parsed
    return None


def object_field(
    value: dict[str, object],
    key: str,
) -> dict[str, object] | None:
    field = value.get(key)
    if isinstance(field, dict):
        return field
    return None


def string_field(value: dict[str, object], key: str) -> str | None:
    field = value.get(key)
    if isinstance(field, str) and field:
        return field
    return None


def candidate_from_meta(
    app: TranscriptApp,
    transcript_path: Path,
    session_id: str,
    cwd: str,
    almanac_roots: tuple[Path, ...],
) -> TranscriptCandidate | None:
    match = nearest_almanac_root(Path(cwd), almanac_roots)
    if match is None:
        return None
    try:
        stat = transcript_path.stat()
    except OSError:
        return None
    if not transcript_path.is_file():
        return None
    return TranscriptCandidate(
        app=app,
        session_id=session_id,
        transcript_path=normalize_path(transcript_path),
        cwd=normalize_path(Path(cwd)),
        repo_root=match.repo_root,
        almanac_path=match.almanac_path,
        modified_at=datetime.fromtimestamp(stat.st_mtime, UTC),
        size_bytes=stat.st_size,
    )
