from pathlib import Path

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.integrations.sources.transcripts.jsonl import (
    candidate_from_meta,
    collect_jsonl,
    parse_json_object,
    read_first_lines,
    string_field,
)
from codealmanac.services.sources.models import TranscriptApp, TranscriptCandidate
from codealmanac.services.sources.requests import DiscoverTranscriptsRequest

CLAUDE_PROJECTS_DIR = ".claude/projects"


class ClaudeTranscriptDiscoveryAdapter:
    app = TranscriptApp.CLAUDE

    def __init__(self, projects_dir: Path | None = None):
        self.projects_dir = projects_dir

    def discover(
        self,
        request: DiscoverTranscriptsRequest,
    ) -> tuple[TranscriptCandidate, ...]:
        root = self.projects_dir or request.home / CLAUDE_PROJECTS_DIR
        candidates: list[TranscriptCandidate] = []
        for path in collect_jsonl(root):
            if "subagents" in path.parts:
                continue
            meta = read_claude_meta(path)
            if meta is None:
                continue
            candidate = candidate_from_meta(
                TranscriptApp.CLAUDE,
                path,
                meta.session_id,
                meta.cwd,
            )
            if candidate is not None:
                candidates.append(candidate)
        return tuple(candidates)


class ClaudeTranscriptMeta(CodeAlmanacModel):
    session_id: str
    cwd: str


def read_claude_meta(path: Path) -> ClaudeTranscriptMeta | None:
    for line in read_first_lines(path, 20):
        parsed = parse_json_object(line)
        if parsed is None:
            continue
        session_id = string_field(parsed, "sessionId")
        cwd = string_field(parsed, "cwd")
        if session_id is not None and cwd is not None:
            return ClaudeTranscriptMeta(session_id=session_id, cwd=cwd)
    return None
