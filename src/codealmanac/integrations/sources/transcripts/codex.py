from pathlib import Path

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.integrations.sources.transcripts.jsonl import (
    candidate_from_meta,
    collect_jsonl,
    object_field,
    parse_json_object,
    read_first_lines,
    string_field,
)
from codealmanac.services.sources.models import TranscriptApp, TranscriptCandidate
from codealmanac.services.sources.requests import DiscoverTranscriptsRequest

CODEX_SESSIONS_DIR = ".codex/sessions"


class CodexTranscriptDiscoveryAdapter:
    app = TranscriptApp.CODEX

    def __init__(self, sessions_dir: Path | None = None):
        self.sessions_dir = sessions_dir

    def discover(
        self,
        request: DiscoverTranscriptsRequest,
    ) -> tuple[TranscriptCandidate, ...]:
        root = self.sessions_dir or request.home / CODEX_SESSIONS_DIR
        candidates: list[TranscriptCandidate] = []
        for path in collect_jsonl(root):
            meta = read_codex_meta(path)
            if meta is None or meta.thread_source == "subagent":
                continue
            candidate = candidate_from_meta(
                TranscriptApp.CODEX,
                path,
                meta.session_id,
                meta.cwd,
            )
            if candidate is not None:
                candidates.append(candidate)
        return tuple(candidates)


class CodexTranscriptMeta(CodeAlmanacModel):
    session_id: str
    cwd: str
    thread_source: str | None = None


def read_codex_meta(path: Path) -> CodexTranscriptMeta | None:
    for line in read_first_lines(path, 20):
        parsed = parse_json_object(line)
        if parsed is None:
            continue
        payload = object_field(parsed, "payload")
        if payload is None:
            continue
        session_id = string_field(payload, "id")
        cwd = string_field(payload, "cwd")
        if session_id is None or cwd is None:
            continue
        return CodexTranscriptMeta(
            session_id=session_id,
            cwd=cwd,
            thread_source=string_field(payload, "thread_source"),
        )
    return None
