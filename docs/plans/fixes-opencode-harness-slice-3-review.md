# Fixes — OpenCode Harness Slice 3 Review

Review pass against `docs/plans/2026-07-08-opencode-harness-slice-3.md`. One substantive finding, three confirmed-clean.

## 🟡 Fix — `services/sources/transcripts.py` had the only per-app conditional in `services/`/`workflows/`

**Finding:** as originally shipped, `transcript_address(candidate)` and `parse_opencode_transcript_ref()` lived in `services/sources/transcripts.py`, with an `if candidate.app == TranscriptApp.OPENCODE` branch. This was a real, working fix for a real constraint (`workflows/` never imports `integrations/` in this codebase, confirmed by grep — `workflows/sync/queue.py` needed to build an OpenCode-shaped address string but couldn't reach into `integrations/sources/transcripts/opencode.py` to do it). But it made this file — previously pure, app-agnostic bookkeeping (`transcript_sort_key`) — the one place outside `integrations/` with provider-specific knowledge, exactly the pattern CLAUDE.md's "provider-specific conditionals outside provider modules" rule flags. The plan's cited precedent (`sync_ingest_title()`'s `candidate.app.value` next door) turned out not to actually be precedent — that's generic string formatting, not a special-cased branch.

**Fix — smaller and cleaner than the reviewer's suggested full adapter-dispatch refactor:** added `TranscriptCandidate.address_override: str | None = None` (`services/sources/models.py`) — a generic field any discovery adapter can set when `transcript_path` alone can't address one session. `transcript_address()` collapses to `candidate.address_override or str(candidate.transcript_path)`: two lines, zero `TranscriptApp` references, zero per-app knowledge. `OpencodeTranscriptDiscoveryAdapter.discover()` (the adapter that already builds each candidate) sets `address_override` itself, using `format_opencode_transcript_ref()`/`parse_opencode_transcript_ref()` — both moved into a new `integrations/sources/transcripts/opencode_ref.py`, entirely inside the OpenCode integration package where the reviewer wanted them. `services/sources/transcripts.py` now has zero `TranscriptApp`/`opencode` references (confirmed by grep). A future 4th transcript app with the same "many sessions, one file" problem sets its own `address_override` in its own discovery adapter — no edit to `services/` required, ever.

Verified against a real `opencode serve` instance (not just fixtures) after the change: discovery correctly sets `address_override`, `transcript_address()` returns it unchanged, and the full discover → address → runtime-inspect round trip still renders the actual model reply correctly.

## 🔵 Polish — confirmed clean, no action taken

- **`query_readonly_or_empty`'s blanket `except sqlite3.Error`:** matches existing precedent (`integrations/sources/transcripts/jsonl.py`'s `except OSError: return ()` for Claude/Codex reads) — not a new, looser tolerance standard. Connection cleanup confirmed correct by reading (the `finally` only runs once a connection is bound).
- **`size_bytes` imprecision (whole shared db file size per candidate):** traced every reader — `cli/render/sync.py` never displays it, `transcript_sort_key` doesn't sort by it, nothing truncates on it. Genuinely inert today, as the plan claimed.
- **Runtime-adapter registration order (`OpencodeTranscriptSourceRuntimeAdapter` before the generic `TranscriptSourceRuntimeAdapter`):** verified load-bearing by reading `SourcesService.inspect_runtime()`'s first-match dispatch loop directly, not just trusting the code comment. The existing ordering regression test would genuinely catch a reordering bug.

## Verification

- `uv run ruff check .` — clean.
- `uv run pytest -q` — 463 passed (test suite updated in place for the `address_override` mechanism, not a net-new count change).
- Live re-verification against a real `opencode serve` instance and real `~/.local/share/opencode/opencode.db` after the architectural fix — full discover → address → inspect round trip confirmed working, test session cleaned up afterward.

## Status

All three slices of `docs/plans/2026-07-07-opencode-harness.md` are now built, reviewed, and fixed. Ready for the combined commit.
