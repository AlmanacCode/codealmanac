import json
from pathlib import Path

from codealmanac.integrations.sources.transcripts.claude import (
    ClaudeTranscriptDiscoveryAdapter,
)
from codealmanac.integrations.sources.transcripts.codex import (
    CodexTranscriptDiscoveryAdapter,
)
from codealmanac.services.sources.models import TranscriptApp
from codealmanac.services.sources.requests import DiscoverTranscriptsRequest


def test_codex_transcript_discovery_reads_metadata_and_skips_subagents(
    tmp_path: Path,
):
    home = tmp_path / "home"
    repo = tmp_path / "repo"
    (repo / "almanac").mkdir(parents=True)
    (repo / "almanac/README.md").write_text("# Wiki\n", encoding="utf-8")
    (repo / "almanac/topics.yaml").write_text("topics: []\n", encoding="utf-8")
    sessions = home / ".codex/sessions/2026/06/29"
    sessions.mkdir(parents=True)
    transcript = sessions / "session.jsonl"
    transcript.write_text(
        json.dumps(
            {
                "payload": {
                    "id": "codex-1",
                    "cwd": str(repo),
                    "thread_source": "user",
                }
            }
        )
        + "\n",
        encoding="utf-8",
    )
    subagent = sessions / "subagent.jsonl"
    subagent.write_text(
        json.dumps(
            {
                "payload": {
                    "id": "codex-2",
                    "cwd": str(repo),
                    "thread_source": "subagent",
                }
            }
        )
        + "\n",
        encoding="utf-8",
    )

    candidates = CodexTranscriptDiscoveryAdapter().discover(
        DiscoverTranscriptsRequest(home=home, apps=(TranscriptApp.CODEX,))
    )

    assert len(candidates) == 1
    assert candidates[0].app == TranscriptApp.CODEX
    assert candidates[0].session_id == "codex-1"
    assert candidates[0].cwd == repo
    assert candidates[0].transcript_path == transcript


def test_claude_transcript_discovery_reads_metadata_and_skips_subagents(
    tmp_path: Path,
):
    home = tmp_path / "home"
    repo = tmp_path / "repo"
    (repo / "almanac").mkdir(parents=True)
    (repo / "almanac/README.md").write_text("# Wiki\n", encoding="utf-8")
    (repo / "almanac/topics.yaml").write_text("topics: []\n", encoding="utf-8")
    projects = home / ".claude/projects/repo"
    projects.mkdir(parents=True)
    transcript = projects / "session.jsonl"
    transcript.write_text(
        f'{{"sessionId":"claude-1","cwd":"{repo}"}}\n',
        encoding="utf-8",
    )
    subagents = projects / "subagents"
    subagents.mkdir()
    (subagents / "session.jsonl").write_text(
        f'{{"sessionId":"claude-2","cwd":"{repo}"}}\n',
        encoding="utf-8",
    )

    candidates = ClaudeTranscriptDiscoveryAdapter().discover(
        DiscoverTranscriptsRequest(home=home, apps=(TranscriptApp.CLAUDE,))
    )

    assert len(candidates) == 1
    assert candidates[0].app == TranscriptApp.CLAUDE
    assert candidates[0].session_id == "claude-1"
    assert candidates[0].cwd == repo
    assert candidates[0].transcript_path == transcript


def test_transcript_discovery_reads_cwd_without_root_filtering(tmp_path: Path):
    home = tmp_path / "home"
    repo = tmp_path / "repo"
    (repo / "docs/almanac").mkdir(parents=True)
    (repo / "docs/almanac/topics.yaml").write_text(
        "topics: []\n",
        encoding="utf-8",
    )
    sessions = home / ".codex/sessions/2026/06/29"
    sessions.mkdir(parents=True)
    transcript = sessions / "session.jsonl"
    transcript.write_text(
        json.dumps({"payload": {"id": "codex-1", "cwd": str(repo)}}) + "\n",
        encoding="utf-8",
    )

    default_candidates = CodexTranscriptDiscoveryAdapter().discover(
        DiscoverTranscriptsRequest(home=home, apps=(TranscriptApp.CODEX,))
    )

    assert len(default_candidates) == 1
    assert default_candidates[0].cwd == repo
