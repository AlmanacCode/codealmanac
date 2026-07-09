# OpenCode Harness — Slice 1: Harness Adapter

Slice 1 of 3 for `docs/plans/2026-07-07-opencode-harness.md` (tracks issue #9). This slice ships the `HarnessAdapter` itself — `init`/`ingest`/`garden` can run through OpenCode. Slice 2 (setup wizard onboarding) and Slice 3 (`sync` transcript discovery/reading) build on top of this slice but are out of scope here.

All design decisions below were confirmed by a live spike against `opencode-ai@1.17.15` on 2026-07-08 (real `opencode serve`, real session, real tool call). Full evidence trail — including the storage-shape and permission-behavior investigation not needed for this slice — lives in the master plan's "Spike findings" and "Windows compatibility" sections; this doc pulls only what Slice 1 needs to build.

## Read before coding

1. `MANUAL.md` — seam-vs-machinery rule, structured-contracts-over-text-scraping (§4)
2. `docs/plans/2026-07-07-opencode-harness.md` — full context, in particular "Spike findings" and "Windows compatibility"
3. `src/codealmanac/services/harnesses/ports.py` — the `HarnessAdapter` protocol this must implement
4. `src/codealmanac/services/harnesses/events.py` / `models.py` — target `HarnessEvent`/`HarnessRunResult`/`HarnessAgentTrace` shapes
5. `src/codealmanac/integrations/harnesses/codex/adapter.py` + `app_server.py` — closest structural precedent: adapter talks to a local server process it starts itself, not stdout scraping. Mirror `process.terminate()`-in-`finally` for server lifecycle.
6. `src/codealmanac/integrations/harnesses/claude/adapter.py` + `stream.py` — precedent for turning a rich structured event stream into `HarnessEvent`s
7. `src/codealmanac/integrations/command.py` — shared `CommandRunner`/`SubprocessCommandRunner`, needs the Windows fix below

## Scope

### Registration (mechanical, do first)

- `services/harnesses/kinds.py`: add `HarnessKind.OPENCODE = "opencode"`
- `services/config/models.py`: add `HarnessKind.OPENCODE` to **three** registries — `HARNESS_MODELS`, `DEFAULT_HARNESS_MODELS`, and `CONTROLLED_HARNESS_MODELS` (the last one is easy to miss; it's a separate flat frozenset gating `HarnessConfig.controlled_model`, not the same dict as the other two). Model values are opaque `"provider/model"` strings, e.g. `"opencode/deepseek-v4-flash-free"` — curate a short allowlist, don't invent new fields on `RunHarnessRequest`.

### `integrations/harnesses/opencode/` package

- `adapter.py` — `OpencodeHarnessAdapter` implementing `check()`/`run()`, same shape as `CodexAppServerHarnessAdapter`/`ClaudeSdkHarnessAdapter`.
- A server-lifecycle module (name TBD, e.g. `server.py`) owning: start `opencode serve --port 0`, parse the bound port from the "opencode server listening on http://127.0.0.1:PORT" startup line (via a background reader thread + `queue.Queue`, not a blocking `readline()` loop — `Popen.stdout.readline()` blocks indefinitely regardless of a wall-clock deadline check between calls, and this needs to be cross-platform since `select()` on pipes isn't available on Windows), wait for readiness, and stop it (`process.terminate()` in `finally`, mirroring `app_server.py:164`). **This one primitive is used by both `check()` and `run()`** — `check()` starts it, makes one HTTP call, tears it down immediately; `run()` starts it, keeps it up for the whole session, tears down when done.
- **No SSE/stream module in this slice — corrected after a supplementary spike.** Original scope (and the master plan) assumed `run()` would consume `GET /event` SSE. Live-tested this before writing the mapping code: across four attempts, the SSE stream never delivered the assistant's reply events (only the user-turn-started events), while the synchronous `POST /session/{id}/message` call reliably returned the complete `{info, parts}` payload every time. **`run()` uses the POST response's `parts` array directly, mapped to `HarnessEvent`s after the call returns — no SSE, no threading, no queue needed for `run()` itself** (the server-lifecycle module's own startup-detection still needs its reader thread, that's unrelated). Full evidence trail is in the master plan's "SSE stream is not reliable for turn completion" spike finding. A part-mapping module (name TBD, e.g. `parts.py`) does the text/tool-call/tool-result/file-edit/usage → `HarnessEvent` translation instead of a stream module. Confirmed live part shapes: `{"type":"text","text":"..."}`, `{"type":"reasoning","text":"...","time":{...}}`, `{"type":"tool","tool":"bash","callID":"...","state":{"status":"completed","input":{...},"output":"...","metadata":{...},"title":"..."}}`, `{"type":"step-start"/"step-finish","reason":"stop"/"tool-calls","tokens":{...},"cost":...}`, `{"type":"patch","files":[...]}`.

### `check()`

1. `opencode --version` via `CommandRunner` — not-installed check, fail fast without touching a server if this fails.
2. If installed: start the ephemeral server (short timeout — a few seconds), call `GET /config/providers`, treat a non-empty `providers` list as authenticated. Empty list or server-start failure/timeout → not available. Always terminate the server regardless of outcome.

**Why not `opencode auth list`:** confirmed live it exits 0 even with zero configured providers and prints decorative TUI text ("0 credentials") — not a parseable signal, and text-scraping it would violate MANUAL.md §4. **Why not read `auth.json`+env vars instead of a server call:** the free `opencode` "Zen" provider needs neither a credentials file nor an env var (`"options":{"apiKey":"public"}`) — a file/env-only check would falsely report a working setup as "not ready."

### `run()`

1. Start the session server scoped to `request.cwd` (via the shared server-lifecycle module).
2. `POST /session?directory=<cwd>` with an explicit `permission: [{permission: "*", pattern: "*", action: "allow"}]` ruleset for defense-in-depth (confirmed live the *unconfigured* default already runs tool calls non-interactively — zero rows ever written to the `permission` table for a real `bash` tool call — but set it explicitly anyway rather than relying on an undocumented default).
3. `POST /session/{id}/message` (blocking, bounded `httpx` timeout — e.g. matching `CLAUDE_RUN_TIMEOUT_SECONDS`'s role for the Claude adapter — so an unexpected hang fails the run cleanly instead of hanging forever, in place of the background permission-poll thread the earlier version of this doc planned) with `parts: [{type: "text", text: request.prompt}]` and `model: {providerID, modelID}` split from the allowlisted `"provider/model"` string at this boundary (note the key-naming inconsistency: `POST /session` create wants `model: {id, providerID, variant}`, `POST /session/{id}/message` wants `model: {providerID, modelID}` — different key names for the same concept between the two endpoints).
4. **No SSE consumption** — corrected by spike, see "Scope" above. Map the POST response's `parts` array directly to `HarnessEvent`s once the call returns.
5. Map OpenCode's session `parentID`/`parent_id` → `HarnessAgentTrace.parent_thread_id`/`child_thread_id` for sub-agent runs — confirmed a first-class relational column on the session, not something to reconstruct from event timing.
6. Return `HarnessRunResult`.

### Windows fix (shared, bundle into this slice)

- `integrations/command.py::SubprocessCommandRunner.run()`: resolve `command` via `shutil.which(command)` before calling `subprocess.run`. On Windows, npm-installed CLIs (`opencode`, and already `codex`/`claude` today) are `.cmd`/`.ps1` shims that `subprocess.run(shell=False)` can't launch directly — a well-known Python-on-Windows gotcha, invisible until now because this repo's CI only runs `ubuntu-latest`. Fixing it here benefits all three harnesses' `check()`, not just OpenCode's — land it as the general fix, not an OpenCode-local workaround.

### Registration

- `integrations/harnesses/__init__.py::default_harness_adapters()` — add `OpencodeHarnessAdapter()`.

## Out of scope (deferred to later slices / not this plan)

- Setup wizard generalization, `AGENTS.md` installer, `SetupTarget.OPENCODE` — Slice 2.
- `sync` transcript discovery/reading, `TranscriptApp.OPENCODE`, the SQLite-backed reader — Slice 3.
- Sub-agent depth limits / call budgets on OpenCode's side — we consume whatever `parentID` it reports, we don't cap its own delegation behavior.

**Two scope reductions made during implementation, disclosed for the review pass rather than silently dropped:**

- **Sub-agent session-tree traversal is not implemented.** `HarnessAgentTrace`/child-session discovery (a session's `parentID` pointing at ours, created when the model invokes an OpenCode "task"/agent-delegation tool) was scoped as confirmed-available in the master plan, based on the OpenAPI schema alone — but no spike ever actually triggered that code path (all spikes used direct `bash` tool calls, never a sub-agent-spawning prompt). Implementing session-tree traversal (list sessions, filter by `parent_id`, recursively fetch/map each child) on an unverified assumption risked shipping speculative code for a flow I have zero live evidence about. `run()` in this slice handles the single root session correctly and completely; multi-session/sub-agent runs will come back with only the root session's events until this is spiked and built as a follow-up (fixes-review or a dedicated slice, whichever the review pass recommends).
- **Test depth for the subprocess/HTTP boundary is lighter than the Codex precedent.** `test_codex_app_server_adapter.py` spawns a real fake `codex` executable and drives the actual `CodexAppServerClient` through real stdio JSON-RPC. `test_opencode_adapter.py` instead unit-tests `OpencodeClient`/`server.py` by monkeypatching `start_opencode_server`/`get_providers`/`create_session`/`post_message` and testing `_wait_for_listening`'s queue/timeout logic directly against a fake `Popen`-shaped object — real coverage of the mapping/parsing/timeout logic (the highest-bug-risk code), but the actual `subprocess.Popen(...)` → real pipe → real `.terminate()` lifecycle is only exercised by hand, not by CI. Consider a fake-`opencode`-executable integration test mirroring the Codex one as a should-fix if the review pass agrees it's worth the added complexity.

## Design decisions

- **Server lifecycle:** `--port 0` confirmed to give an OS-assigned ephemeral port (two concurrent instances got different ports in the spike) — avoids fixed-port collisions across concurrent runs. One server per `run()` call, scoped to that run only.
- **Structured contracts over text scraping (MANUAL.md §4):** consume typed SSE message parts directly; the only plain-text parse in this slice is extracting the bound port from the server's one-line startup message, which is an acceptable one-time readiness signal, not per-event scraping.
- **Model shape:** confirmed structured (`{providerID, modelID}`/`{id, providerID, variant}`), not opaque — curate an allowlist of `"provider/model"` strings and split at the adapter boundary right before building request payloads. Add a smoke test for the `id`/`modelID` key-naming inconsistency between the two endpoints so a future opencode release changing it is caught, not silently swallowed.
- **Permission/non-interactive behavior:** confirmed default-safe via the HTTP API (unlike the TUI), but pass an explicit allow-ruleset anyway and keep a defensive permission-poll fallback — belt-and-suspenders, not paranoia-driven machinery.
- **`check()` cost:** accepted that OpenCode's `check()` is heavier than Codex/Claude's (spins up a server vs. one subprocess call) because the free-tier provider makes file/env-only checks unreliable. Revisit later if this proves too slow/flaky in practice.

## File changes

| File | Change |
|---|---|
| `src/codealmanac/services/harnesses/kinds.py` | add `HarnessKind.OPENCODE = "opencode"` |
| `src/codealmanac/services/config/models.py` | add `HarnessKind.OPENCODE` to `HARNESS_MODELS`, `DEFAULT_HARNESS_MODELS`, `CONTROLLED_HARNESS_MODELS` |
| `src/codealmanac/integrations/harnesses/opencode/__init__.py` | new |
| `src/codealmanac/integrations/harnesses/opencode/adapter.py` | new — `OpencodeHarnessAdapter` |
| `src/codealmanac/integrations/harnesses/opencode/server.py` (name TBD) | new — shared ephemeral server start/stop + `POST /session`, used by both `check()` and `run()` |
| `src/codealmanac/integrations/harnesses/opencode/parts.py` (name TBD) | new — `POST /session/{id}/message` response `parts` → `HarnessEvent` mapping (no SSE, see Scope) |
| `src/codealmanac/integrations/harnesses/__init__.py` | register `OpencodeHarnessAdapter()` in `default_harness_adapters()` |
| `src/codealmanac/integrations/command.py` | Windows fix — resolve `command` via `shutil.which()` in `SubprocessCommandRunner.run()` |
| `tests/test_opencode_adapter.py` | new |

## Test coverage

- `check()`: not-installed (`FileNotFoundError` on `opencode --version`, no server touched), server-fails-to-start (bounded timeout → "not available", not a hang), `GET /config/providers` returns empty `providers` (not authenticated), non-empty (authenticated), server always terminated regardless of outcome.
- `run()`: prompt → session create → blocking message POST → `HarnessRunResult`, using a fake/stubbed HTTP client (no real `opencode` process in unit tests, consistent with how Codex/Claude adapters are tested).
- Part mapping: one test per OpenCode part type → expected `HarnessEventKind` (text, reasoning, tool-call/tool-result, patch/file-edit, step-finish/usage).
- Sub-agent trace: a session with `parentID` set maps to `HarnessAgentTrace.parent_thread_id` correctly.
- Model-string splitting: allowlisted `"provider/model"` string produces the correct `{providerID, modelID}`/`{id, providerID, variant}` payload shape for both endpoints.
- `HarnessesService` registration: adapter is discoverable via `HarnessKind.OPENCODE` once registered (extends existing `test_harnesses_service.py`, no new file needed there).
- `SubprocessCommandRunner` Windows resolution: `shutil.which()` is consulted before `subprocess.run` (stub it, assert the resolved path is what gets executed).

## Next steps after this slice

1. Build against this doc.
2. Review pass (bugs/omissions) → `docs/plans/fixes-opencode-harness-slice-1-review.md`, shipped as its own commit.
3. Move to Slice 2 (setup wizard) — write `docs/plans/2026-07-08-opencode-harness-slice-2.md` next, not before this slice is reviewed and fixed.
