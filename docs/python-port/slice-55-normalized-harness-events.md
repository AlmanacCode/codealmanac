# Slice 55 - Normalized Harness Events

Date: 2026-06-29

## Scope

Make lifecycle job logs consume a provider-neutral harness event stream.

This slice adds `HarnessEvent` to the harness service contract and changes
`ingest` and `garden` to record all returned harness events before mutation
safety and harness success validation.

## Non-Goals

- No new public command.
- No hosted log, upload, or dashboard surface.
- No Codex app-server port in this slice.
- No streaming UI. Events are recorded after the current harness run returns.
- No raw provider transcript persistence in the run-log contract.

## Design

`HarnessRunResult` now carries:

```python
events: tuple[HarnessEvent, ...] = ()
```

`HarnessEvent` is the CodeAlmanac-owned audit shape:

```python
kind: HarnessEventKind
message: str
status: HarnessRunStatus | None = None
```

Current Codex and Claude CLI adapters emit one terminal `done` event. Adapters
that later expose richer lifecycle data can emit text, tool, usage, warning,
error, and done events through the same contract.

Workflows do not read raw Claude or Codex transcript files for log display.
They persist returned `HarnessEvent` values through `RunsService.record_event`.
If an old or fake adapter returns no events, `workflows/lifecycle.py` creates a
terminal fallback event from `kind`, `status`, and the first output line.

## Codex Exec Vs App-Server

`codex exec` remains the v1 local transport because it is enough for one prompt,
one final message, changed-file detection, and optional provider transcript
identity.

Codex app-server is the better transport when the product needs the normalized
event stream to include actual turn text, tool starts/results, usage, actor or
subagent attribution, and root-turn lifecycle control. That is now a clear
future trigger, not a parity migration to do by default.

## Tests

- Codex adapter success/failure returns terminal `done` events.
- Claude adapter success/failure returns terminal `done` events.
- Ingest records multiple normalized harness events in order.
- Garden and failure-log tests keep the fallback terminal event behavior.

## Verification

Initial focused gate:

```bash
uv run pytest tests/test_harnesses_service.py tests/test_codex_adapter.py tests/test_claude_adapter.py tests/test_ingest_workflow.py tests/test_garden_workflow.py
uv run ruff check src/codealmanac/services/harnesses src/codealmanac/integrations/harnesses src/codealmanac/workflows tests/test_harnesses_service.py tests/test_codex_adapter.py tests/test_claude_adapter.py tests/test_ingest_workflow.py tests/test_garden_workflow.py
```

Result: 35 tests passed; focused ruff passed.

Full gate:

```bash
uv run pytest
uv run ruff check .
git diff --check
uv build --wheel --no-build-logs --out-dir /tmp/codealmanac-build-slice55
```

Result: 236 tests passed; full ruff passed; diff hygiene passed; wheel built
as `codealmanac-0.1.0-py3-none-any.whl`. Wheel inspection confirmed
`codealmanac/services/harnesses/models.py`,
`codealmanac/integrations/harnesses/codex/adapter.py`,
`codealmanac/integrations/harnesses/claude/adapter.py`,
`codealmanac/workflows/lifecycle.py`,
`codealmanac/workflows/ingest/service.py`, and
`codealmanac/workflows/garden/service.py`.

Live dogfood used an isolated temp registry and temp Git repo. A fake Codex
harness returned four normalized events; public `codealmanac jobs logs` showed:

```text
6	output	agent read source note
7	tool	agent opened almanac/pages/eventful-dogfood.md
8	tool	agent wrote almanac/pages/eventful-dogfood.md
9	output	codex succeeded: updated wiki
10	status	done
```
