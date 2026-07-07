# Hide Future Provider Text Deltas Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Stop future CodeAlmanac jobs from persisting token-by-token assistant text deltas in run logs.

**Architecture:** Codex and Claude may continue to emit `TEXT_DELTA` harness events because those are real provider stream events. The operation runner decides which harness events become durable product history. `TEXT_DELTA` is live-only stream material, so the operation runner skips it when recording run events.

**Tech Stack:** Python 3.12, Pydantic models, SQLite run event store, pytest, Ruff.

---

## Product Decision

`TEXT_DELTA` is not durable product history.

Persist:

- `TEXT`
- `TOOL_USE`
- `TOOL_RESULT`
- `TOOL_SUMMARY`
- `PROVIDER_SESSION`
- `CONTEXT_USAGE`
- `WARNING`
- `ERROR`
- `DONE`
- agent trace events
- run status events

Do not persist:

- `TEXT_DELTA`

This is provider-neutral. It applies to Codex and Claude.

## Scope

This affects future jobs created by:

- `codealmanac init`
- `codealmanac ingest`
- `codealmanac garden`
- ingest jobs created by `codealmanac sync`
- scheduled sync ingest jobs
- scheduled garden jobs

This does not affect:

- old jobs already stored in the database
- provider transcripts
- Codex/Claude adapters
- viewer/server read paths
- read-only commands such as `search`, `show`, `topics`, `health`, `validate`,
  `serve`, `config`, `automation`, `update`, `doctor`, and `list`

## Out Of Scope

- No old-log filtering.
- No database migration.
- No live typing renderer.
- No `--raw` mode.
- No delta coalescing.
- No provider adapter changes.

Old jobs that already persisted `TEXT_DELTA` rows can remain noisy because the
product is not in public use yet.

## Implementation

### Step 1: Add A Predicate

Modify:

```text
src/codealmanac/workflows/operations/harness.py
```

Add:

```python
def should_record_harness_event(event: HarnessEvent) -> bool:
    return event.kind != HarnessEventKind.TEXT_DELTA
```

This function answers:

```text
Should this provider event become durable job history?
```

### Step 2: Use It At The Operation Boundary

Modify:

```text
src/codealmanac/workflows/operations/service.py
```

Change:

```python
for event in harness_events(harness):
    self.record(...)
```

to:

```python
for event in harness_events(harness):
    if not should_record_harness_event(event):
        continue
    self.record(...)
```

### Step 3: Add Regression Coverage

Modify:

```text
tests/test_ingest_workflow.py
```

Add `TEXT_DELTA` events before the existing completed `TEXT` event in
`EventfulHarnessAdapter`.

Assert the run log still contains the completed assistant message and no
`TEXT_DELTA` harness events.

## Verification

Targeted:

```bash
uv run pytest tests/test_ingest_workflow.py::test_ingest_workflow_records_normalized_harness_events -q
uv run pytest tests/test_ingest_workflow.py tests/test_codex_app_server_adapter.py tests/test_claude_adapter.py -q
```

Full:

```bash
uv run ruff check .
uv run pytest -q
uv run codealmanac validate
```

Expected:

- Future runs no longer persist `TEXT_DELTA`.
- Full assistant `TEXT` messages still persist.
- Tool/status/error/usage events still persist.
- Existing noisy jobs remain unchanged.
