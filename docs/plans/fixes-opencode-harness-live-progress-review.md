# Fixes — OpenCode Live Progress & Hang Detection Review

Review pass against `docs/plans/2026-07-09-opencode-harness-live-progress-and-hang-detection.md`. Four findings, all resolved.

## 🟡 Fix — stray debug artifact committed to the repo root

**Finding:** a 0-byte file literally named `select data from part where id='prt_f43ffd97000118zZAICSCswGJD'` was sitting untracked in the repo root — the fallout of an earlier malformed `sqlite3 <query> <db-path>` shell invocation (argument order swapped) run during live debugging of the stuck-tool-call bug.

**Fix:** deleted (`rm`). Confirmed gone from `git status` and `ls -la`.

## 🟡 Fix — narrow post-timeout race in `client.py`'s sender/watchdog join

**Finding:** `run_once()`'s `while sender_thread.is_alive(): ...` loop exits either by raising `OpencodeStuckToolCallError` (watchdog fired) or by the sender thread finishing normally. On the normal-exit path, there was no comment explaining why `watchdog.stuck_reason` isn't re-checked once more before trusting `message_result`, nor why the subsequent `watchdog_thread.join(timeout=...)` is a *bounded* wait rather than an unconditional one.

**Fix:** added two comment blocks at `src/codealmanac/integrations/harnesses/opencode/client.py:250` documenting the reasoning inline: a real result from `post_message` wins over a heuristic that fired a beat late (deliberately not re-checked, to avoid turning a clean handoff into a race); and the bounded `watchdog_thread.join()` can't block process exit either way since the watchdog is a daemon thread, and a residual very-late event landing after the `events` snapshot is low-consequence (list append is GIL-atomic, and real callers persist events live via `on_event`, not by re-reading `result.events`).

## 🔵 Polish — `progress.py` docstring didn't state the "no narration while running" limitation

**Finding:** `OpencodeProgressWatchdog` only calls `map_opencode_part` (which produces the live `TOOL_USE` event) once a tool call's `state.status` leaves `"running"` — so a long-running call produces zero live narration until it settles or is flagged stuck. This is true and intentional, but wasn't documented anywhere a future reader would see it before being surprised by it.

**Fix:** added a paragraph to `OpencodeProgressWatchdog`'s class docstring (`progress.py:89-95`) stating this explicitly, cross-referenced to the plan doc's live-verification timestamps that back it up.

## 🔵 Polish — `opencode_db.py`'s `_ENTRIES_QUERY` had the same unaliased-column shape that caused the real `progress.py` bug

**Finding:** the bug just fixed in `progress.py` (`SELECT part.data, message.data` — both columns collapse to the bare name `data` under `sqlite3.Row`'s dict-style lookup, silently returning only the last match) has a structural twin in the pre-existing `integrations/sources/transcripts/opencode_db.py::_ENTRIES_QUERY`, written during Slice 3. It wasn't actually broken — `read_opencode_session_entries()` reads rows positionally (`row[0]`, `row[1]`), which sidesteps the collision — but it was one thoughtless refactor (e.g. someone "cleaning up" positional access to `row["data"]`) away from reintroducing the exact bug that took a live smoke test to catch the first time.

**Fix:** aliased the query to `SELECT part.data AS part_data, message.data AS message_data ...` and switched `read_opencode_session_entries()`'s row access from positional to the explicit keys, matching the pattern now used in `progress.py`. Added a comment on the query explaining why the aliases exist and pointing at the sibling bug. This closes the landmine rather than just documenting it.

## Verification

- `uv run ruff check .` — clean.
- `uv run pytest -q` — 471 passed, including `tests/test_opencode_transcripts.py` (Slice 3 transcript-reading tests, unaffected by the row-access change) and `tests/test_opencode_adapter.py` (live-progress/hang-detection tests).

## Status

Live progress narration and hang detection are built, reviewed, and fixed. Still pending before commit: user's own hands-on test run against a real `opencode serve` instance on their project, and removal of the LaunchAgents installed during earlier setup testing.
