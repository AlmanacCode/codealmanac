# Fixes — OpenCode Harness Final Full-Scope Review

Last pass before push: one review agent looked at the entire OpenCode harness feature as a whole (all 4 prior slice/fix passes combined — adapter, setup wizard, transcript discovery, live-progress/hang-detection, plus the same-day model-allowlist fix), with explicit focus on cross-slice consistency and Windows compatibility, since that was an explicit, repeated requirement from the start of this work. Five findings.

## 🔴 Fix — `start_opencode_server()` never resolved the executable through PATH/PATHEXT, unlike the sibling fix it was supposed to share

**Finding:** `integrations/command.py`'s `SubprocessCommandRunner` was fixed earlier in this work specifically to resolve npm-installed `.cmd`/`.ps1` shims via `shutil.which()` before calling `subprocess.run` — with a comment claiming "fixes all three harnesses' check(), not just one." But `check()`'s fast path (`opencode --version`) is the *only* OpenCode call that actually goes through `SubprocessCommandRunner`. `server.py::start_opencode_server()` — used by both `check_providers()` and every real `run()` — called `subprocess.Popen` directly with the bare command name and no resolution. On Windows, this meant `opencode --version` could report success while every call that actually spawns a server (which is nearly everything real) would raise `FileNotFoundError`.

**Fix:** applied the identical `shutil.which(command) or command` resolution in `server.py::start_opencode_server()`, mirroring `command.py`'s exact pattern, with a comment cross-referencing both the sibling fix and the specific failure mode it closes. Added two direct unit tests (`test_start_opencode_server_resolves_command_through_path`, `test_start_opencode_server_falls_back_to_bare_command_when_unresolved`) — no prior test exercised `start_opencode_server()`'s own `Popen` call at all (existing tests fake the whole function out).

## 🟡 Fix — `append_event`/`emit_result` were three independently-maintained copies (Codex, Claude, OpenCode)

**Finding:** identical function bodies existed in `codex/stream.py`, `claude/client.py`, and `opencode/client.py` — provider-agnostic event-plumbing that had been copy-pasted into each new harness instead of reusing a shared seam (the same pattern `fields.py` had already been correctly hoisted out of `codex/` for).

**Fix:** created `integrations/harnesses/stream.py` (sibling to the existing `fields.py`) holding `append_event`, `append_events`, and `emit_result`. Deleted `codex/stream.py` and the local redefinitions in `claude/client.py` and `opencode/client.py`; all three now import from the shared module. No behavior change — pure de-duplication.

## 🟡 Fix — generic transcript runtime adapter's correctness silently depended on registration order

**Finding:** `TranscriptSourceRuntimeAdapter.supports()` (the generic/non-OpenCode adapter) matched *any* `SourceKind.TRANSCRIPT` ref with no further discrimination, while `OpencodeTranscriptSourceRuntimeAdapter.supports()` only matched its own `db-path::session-id` refs. The only thing preventing the generic adapter from also claiming OpenCode refs was that `default_transcript_runtime_adapters()` happened to list OpenCode's adapter first — a real regression test caught this today, but the underlying `supports()` was still an overly broad implementation that only worked by list-order accident.

**Fix:** `TranscriptSourceRuntimeAdapter.supports()` (`integrations/sources/transcripts/runtime.py`) now explicitly excludes refs that `parse_opencode_transcript_ref` can parse, so the two adapters' `supports()` are disjoint rather than one being an accidental superset of the other. Updated `default_transcript_runtime_adapters()`'s comment to reflect that order is no longer load-bearing (the existing ordering test stays as defense-in-depth). Added `test_generic_runtime_adapter_rejects_opencode_shaped_refs_on_its_own`, which would fail if this adapter were ever asked first.

## 🔵 Polish — documented why `OPENCODE_TRANSCRIPT_SEPARATOR = "::"` is safe next to a Windows drive-letter colon

**Finding:** a future reader could reasonably worry that a two-character `"::"` separator collides with a Windows path's single drive-letter colon (`C:\Users\...`). It doesn't — `rpartition("::")` searches for the whole two-character substring, not a lone `:` — but nothing said so.

**Fix:** added a one-line comment on `OPENCODE_TRANSCRIPT_SEPARATOR` in `opencode_ref.py`, and a real regression test (`test_parse_opencode_transcript_ref_handles_windows_drive_letter_colon`) round-tripping a `C:\...` path through `format_opencode_transcript_ref`/`parse_opencode_transcript_ref`, so the comment's claim is actually verified rather than asserted.

## 🔵 Noted, no code change — `codealmanac setup` now writes `~/.config/opencode/AGENTS.md` unconditionally by default

Consistent with how Codex/Claude instructions are already installed unconditionally on a bare `setup` run (opt-out via `--target`, not opt-in) — not a new pattern, just worth surfacing: existing users who re-run `setup` without `--target` after upgrading will get a third `AGENTS.md` written even if they've never touched OpenCode.

## Residual, disclosed risk — not fixed, cannot be fixed without a Windows machine

`OPENCODE_DB_RELATIVE_PATH` (`~/.local/share/opencode/opencode.db`) is inferred from the macOS spike and has never been verified against a real Windows OpenCode install. This was already an open item in the original plan's "Next steps" ("Windows verification pass") and remains open. The blast radius if wrong is graceful degradation, not a crash: `query_readonly_or_empty` soft-fails to `()` on a missing/wrong-shaped DB, so OpenCode sync would silently find zero transcripts on Windows rather than error. Everything else Windows-relevant (subprocess spawning, path joining, stdout draining without `select()`, thread-based timeouts, no POSIX-only signal usage) was checked and confirmed correct.

## Verification

- `uv run ruff check .` — clean.
- `uv run pytest -q` — 482 passed (4 new tests: 2 for `start_opencode_server`'s executable resolution, 1 for the generic runtime adapter's explicit OpenCode exclusion, 1 for the Windows drive-letter separator round trip).
- Both `init` and `garden` were live-tested end-to-end against a real project (`send_cloudaccess_emails`) with a real `opencode serve` instance before this pass; that verification stands (this pass only touched Windows-relevant and de-duplication code, re-covered by the full test suite, not re-run live since these are macOS-invisible fixes by nature).

## Status

All four OpenCode harness slices, the live-progress/hang-detection follow-up, the model-allowlist fix, and this final full-scope review are built, reviewed, and fixed. Not yet committed — pending the user's go-ahead.
