# OpenCode Harness — Live Progress + Hang Detection

Follow-up to Slice 1 (`docs/plans/2026-07-08-opencode-harness-slice-1.md`), driven by real evidence from live testing on 2026-07-08/09: three separate hangs across two different models (`opencode/deepseek-v4-flash-free`, `openai/gpt-5.5`), all the same shape — a `glob` or `read` tool call gets scoped outside the target repo (nonexistent path, an unrelated huge directory, a binary file from a different project) and never returns. Confirmed via web search to be a known, currently-open upstream OpenCode issue, not something specific to this adapter or model choice — see "Evidence" below.

**Goal:** replace the current "block for up to 900s, then report a generic timeout" behavior with (1) live event narration while the blocking call is in flight, and (2) precise, fast hang detection based on watching individual tool calls' age, not just total elapsed time.

## Evidence

- Three real hangs, traced via direct SQLite inspection during live testing: a `glob` call against a mangled nonexistent path, a `glob` call against `pattern: "**/.codealmanac/**"` scoped to the whole `~/dev/projects` directory instead of the target repo, and a `read` call against a binary file (`.venv/bin/codealmanac`) from an unrelated project. All three sat at `"status": "running"` indefinitely — no error, no completion, ever.
- Upstream confirmation (web search, 2026-07-09): [Issue #33541](https://github.com/anomalyco/opencode/issues/33541) ("Glob tool execute has no timeout"), [Issue #2102](https://github.com/sst/opencode/issues/2102), [Issue #20096](https://github.com/anomalyco/opencode/issues/20096) ("Non-task tools (bash, read, write, etc.) execute with no deadline"), [Issue #29294](https://github.com/anomalyco/opencode/issues/29294) (same pattern, shell tool). This is OpenCode's own tool-execution layer lacking any internal timeout — not fixable from our side, only detectable and worked around.

## Design

One mechanism serves both goals: a background thread that polls OpenCode's own SQLite database (the same one Slice 3's transcript reader already knows how to read) while the blocking `POST /session/{id}/message` call is in flight.

### Why polling the DB, not retrying SSE

Slice 1 already spiked OpenCode's `GET /api/event` SSE stream four times and found it never delivered assistant-turn events, only user-turn-started events (see master plan's "SSE stream is not reliable for turn completion"). Rather than re-bet on that, reuse what's already proven reliable in this codebase: the read-only SQLite querying built for Slice 3, exercised repeatedly and correctly throughout tonight's live debugging. Watching the *whole session tree* (root + dynamically-discovered sub-agent sessions) also needs cross-session visibility a single event stream wouldn't cleanly give us anyway.

### What the watchdog does, every ~2 seconds

1. Query all parts for the root session and every known child session (discovered dynamically — see below), diff against a `seen_part_ids: set[str]`, map new ones to `HarnessEvent`s via the existing `map_opencode_part()`, and emit them through `on_event` — this is the live-narration half.
2. Discover new children: watch for `{"type": "tool", "tool": "task", "state": {"metadata": {"sessionId": ...}}}` parts as they appear anywhere in the tree. On first sight of a new child session id, emit `AGENT_SPAWNED` (`HarnessAgentTrace(parent_thread_id=<spawning session>, child_thread_id=<new session>, prompt=<task input.prompt>, model=...)`) and start polling that session too. When that same tool part later transitions to `status: "completed"`/`"error"`, emit `AGENT_COMPLETED`/an `ERROR` event.
3. Track the age of every currently-open (`status: "running"`) tool-call part across the whole tree. If any single one exceeds `OPENCODE_STUCK_TOOL_CALL_SECONDS` (default 240s — see "Threshold" below) with no transition, that's the hang signal.

### What happens when a hang is detected

The main thread (blocked on `post_message`, running on its own sender thread so the watchdog can preempt it — see "Concurrency" below) raises `OpencodeStuckToolCallError` naming the specific tool, its input, and which session it belongs to. This unwinds through the `with start_opencode_server(...)` context manager, which terminates the server process — killing the in-flight HTTP connection the sender thread is blocked on, so that thread errors out and dies (daemon, so it never blocks process exit; its error is discarded, ours is authoritative). No true cross-thread cancellation needed.

Error message shape:
> `OpenCode's "glob" tool call has been stuck for 240s+ with no response (session ses_...) — this is a known upstream OpenCode reliability issue (github.com/anomalyco/opencode/issues/33541), not specific to this run.`

### Concurrency shape

```
main thread:
  with start_opencode_server(...) as server:
    session = create_session(...)
    watchdog = OpencodeProgressWatchdog(root_session_id, root_actor, ...)
    watchdog_thread = Thread(target=watchdog.run, args=(stop_event, events, on_event))
    watchdog_thread.start()

    sender_thread = Thread(target=lambda: post_message(...) -> message_result)
    sender_thread.start()
    while sender_thread.is_alive():
      if watchdog.stuck_reason is not None:
        raise OpencodeStuckToolCallError(watchdog.stuck_reason)  # unwinds -> server.terminate()
      sender_thread.join(timeout=1.0)
    stop_event.set(); watchdog_thread.join(timeout=5)

    response = message_result["response"]  # or re-raise message_result["error"]
    # Final reconciliation pass: diff response["parts"] against seen_part_ids
    # once more before building the result, in case the watchdog's last poll
    # cycle missed something in the last ~2s window. Dedup by part id makes
    # this safe to run unconditionally.
```

### Threshold

From tonight's real data: every genuine hang sat with zero progress for 10+ minutes before manual detection; normal step-to-step gaps during healthy runs (including the successful `gpt-5.5` run) were under 2 minutes. **`OPENCODE_STUCK_TOOL_CALL_SECONDS = 240`** (4 minutes) — long enough to not false-positive on legitimately slow tool calls, short enough to cut the worst case from 900s to well under a third of that. Configurable via env var, matching Codex's existing `CODEALMANAC_CODEX_APP_SERVER_*_TIMEOUT_MS` pattern (`CODEALMANAC_OPENCODE_STUCK_TOOL_CALL_SECONDS`).

The existing `OPENCODE_RUN_REQUEST_TIMEOUT_SECONDS = 900.0` stays as a final backstop (in case the watchdog itself has a bug or edge case) but should rarely be the thing that actually fires once this ships.

## Scope

### New: `integrations/opencode_paths.py`

`OPENCODE_DB_RELATIVE_PATH = Path(".local/share/opencode/opencode.db")` — promoted out of `integrations/sources/transcripts/opencode.py` (which starts importing it from here instead of defining it locally) so `integrations/harnesses/opencode/` doesn't duplicate this fact. Small, deliberate exception to "don't add a module for one constant" — the alternative (two independently-maintained copies of a deployment-path assumption already flagged as Windows-unverified) is a worse drift risk than one three-line file.

### New: `integrations/harnesses/opencode/progress.py`

- `OpencodeProgressWatchdog` — owns the poll loop, `seen_part_ids`, known-children tracking, stuck-tool-call detection. Constructed with `(root_session_id, root_actor, db_path, poll_interval_seconds, stuck_after_seconds)`.
- Raw queries via `codealmanac.database.query_readonly_or_empty` directly (not importing `integrations/sources/transcripts/opencode_db.py` — that module's `TranscriptRuntimeEntry` mapping is a different domain shape than `HarnessEvent`; both packages depend on the shared `codealmanac.database` primitive independently, no cross-package coupling between `harnesses/` and `sources/`).
- `.stuck_reason: OpencodeStuckToolCall | None` — set by the poll loop, read by the main thread's wait loop.

### `integrations/harnesses/opencode/state.py`

Re-add `agent_parents: dict[str, str | None]` / `agent_labels: dict[str, str]` — removed as dead code in the Slice 1 review specifically with the note "add them back alongside whatever code actually populates them." This is that code.

### `integrations/harnesses/opencode/client.py`

`run_once()` rewritten per the concurrency shape above. New exception `OpencodeStuckToolCall(Exception)` (message includes tool name, input summary, session id, elapsed seconds, and the upstream issue URL) added to `failures.py`'s classification (new `opencode.stuck_tool_call` failure code) and to `client.py`'s `run()`/`check_providers()` except chains — though `check_providers()` doesn't call `run_once()`, so only `run()`'s chain needs it.

### `integrations/harnesses/opencode/parts.py`

No change to `map_opencode_part()` itself — reused as-is by the watchdog. New small helper: `is_task_spawn(part) -> tuple[str, str] | None` (returns `(child_session_id, prompt)` if the part is a `task` tool call carrying spawn metadata, else `None`) and `is_task_settled(part) -> HarnessToolStatus | None` (completed/error, for firing `AGENT_COMPLETED`).

## Out of scope

- Fixing OpenCode's own tool-execution timeout — not ours to fix, only detect around.
- Re-attempting SSE — explicitly not revisiting that decision here; the DB-polling approach supersedes needing it.
- Retrying automatically after a detected hang (e.g. auto-retry with a different model) — a policy decision one layer up (workflows/CLI), not this adapter's job; it should fail clearly and let the caller decide.

## File changes

| File | Change |
|---|---|
| `src/codealmanac/integrations/opencode_paths.py` | new — `OPENCODE_DB_RELATIVE_PATH`, shared by harnesses and sources/transcripts |
| `src/codealmanac/integrations/sources/transcripts/opencode.py` | import `OPENCODE_DB_RELATIVE_PATH` from the new shared module instead of defining it locally |
| `src/codealmanac/integrations/harnesses/opencode/progress.py` | new — `OpencodeProgressWatchdog` |
| `src/codealmanac/integrations/harnesses/opencode/state.py` | re-add `agent_parents`/`agent_labels` |
| `src/codealmanac/integrations/harnesses/opencode/client.py` | `run_once()` rewritten for the watchdog + sender-thread concurrency shape; new timeout/threshold constructor params |
| `src/codealmanac/integrations/harnesses/opencode/failures.py` | new `opencode.stuck_tool_call` classification |
| `src/codealmanac/integrations/harnesses/opencode/parts.py` | new `is_task_spawn`/`is_task_settled` helpers |
| `tests/test_opencode_adapter.py` | new coverage — see below |

## Test coverage

- `OpencodeProgressWatchdog` unit tests against a fixture SQLite db (same pattern as `test_opencode_transcripts.py`): new parts get mapped and emitted; a newly-appearing `task` part triggers `AGENT_SPAWNED` and starts tracking the child; a part transitioning `running` → `completed` between polls fires `AGENT_COMPLETED`; a part stuck at `running` past the threshold sets `stuck_reason`; a part stuck *under* the threshold does not.
- `run_once()` integration-style test: fake `post_message` that sleeps briefly then returns, with a fixture db seeded with parts appearing "during" that sleep (via a real background writer thread in the test, or a fake watchdog data source) — assert live events arrive via `on_event` before the final result, not just batched at the end.
- Hang-detection end-to-end: fake `post_message` that never returns (blocks on an `Event().wait()`) plus a fixture db with a part stuck past the threshold — assert `run()` returns a failed result mentioning the tool name and the upstream issue, well before the outer 900s timeout, and that the server's `terminate()` gets called (no leaked process in the test).
- Regression: existing `test_opencode_client_run_maps_parts_to_events` (no sub-agents, fast return) must still pass unchanged — the new machinery shouldn't change behavior for the simple, healthy-path case.

## Live verification (2026-07-09, post-build)

Built against this doc, then verified against a real `opencode serve` instance (not just fixtures) before considering it done:

- **Found and fixed a real bug unit tests couldn't have caught:** the first live run showed the user's own prompt text arriving as a spurious `TEXT` event. The synchronous POST response never had this problem (it only ever returns the new assistant message's parts), but the watchdog polls the *whole* session's parts table, which includes the user's own input part too. Fixed by joining `message` and filtering to `role == "assistant"` in `_PARTS_QUERY`/`_poll_session` (`progress.py`). Added `test_watchdog_ignores_user_authored_parts` as a regression test, and updated the test fixture DB helpers to include a `message` table (the query is now an inner join, so fixtures without one silently returned zero rows — another thing only live testing surfaced).
- **Live narration confirmed working**, timestamped: events for a simple tool-call prompt arrived at 0.98s / 4.01s / 4.02s / 5.33s / 5.34s — genuinely incremental, not batched at the end.
- **Sub-agent spawn/complete confirmed working**, timestamped: `AGENT_SPAWNED` at 4.78s with correct parent/child trace, `AGENT_COMPLETED` at 6.32s tagged to the `HELPER` actor, and the sub-agent's own reply text correctly attributed to `actor=helper/Helper 1` rather than the root — full round-trip through a real `task` tool delegation.
- **Not independently re-verified live:** the stuck-tool-call detection path itself (unit-tested with a fixture past the threshold, and confirmed via the two real hangs that motivated this whole doc — but a *fresh* real hang wasn't reproduced on demand in this pass, since the underlying upstream bug is inherently non-deterministic). Real coverage exists from the incidents that led to this doc; a fresh live repro would need to wait for OpenCode to reproduce the same failure mode again.

## Next steps

1. ~~Build against this doc.~~ Done.
2. Review pass → `docs/plans/fixes-opencode-harness-live-progress-review.md`, own commit.
3. ~~Re-run the live `send_cloudaccess_emails` test end to end~~ — superseded by the live verification above (ran fresh, smaller live tests instead of repeating the full multi-minute wiki-build run).
