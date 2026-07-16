# CLI Telemetry Review Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close the five validated PR #36 review findings without weakening consent, privacy, run-ledger honesty, or existing CLI behavior.

**Architecture:** The run ledger will own durable failure classification and expose whether a terminal transition actually changed state. Telemetry will react only to that first transition. Exception events will contain structural data only, and the PostHog adapter will rebuild outbound properties from the exact validated event keys instead of subtracting known SDK fields.

**Tech Stack:** Python 3.12+, Pydantic models, SQLite run ledger, PostHog Python SDK, pytest, Ruff, uv.

---

## Accepted shape

```python
# arch: workflows classify · ledger persists · transition reports change
result = runs.store.finish(..., failure_category=category)
if result.changed:
    telemetry.capture_lifecycle(result.record, spec)
return result.record

# arch: exception telemetry is structural, never free-form
shape = exception_type + fingerprint + codealmanac_frames

# arch: validated service keys are the entire outbound property surface
allowed = frozenset(event.properties)
posthog.before_send = keep_only(message.properties, allowed)
```

The existing classification sites remain authoritative. Telemetry does not inspect local error prose to guess a category.

### Task 1: Integrate current main cleanly

**Files:**
- Modify: `pyproject.toml`
- Regenerate: `uv.lock`

1. Merge `origin/main` into `codex/cli-telemetry`.
2. Preserve both the main-branch `filelock` dependency and the telemetry branch `posthog>=7,<8` dependency.
3. Regenerate `uv.lock` with `uv lock`; do not hand-edit generated package entries.
4. Run `uv sync --locked` and the focused setup/update tests changed by main.

### Task 2: Make exception capture structural and non-throwing

**Files:**
- Modify: `src/codealmanac/services/telemetry/service.py`
- Modify: `src/codealmanac/cli/execution.py`
- Modify: `src/codealmanac/workflows/run_queue/worker.py`
- Test: `tests/test_telemetry_service.py`
- Test: `tests/test_cli_telemetry.py`
- Test: `tests/test_run_telemetry.py`

1. Add failing tests proving arbitrary relative names, prompts, provider output, and repository text never enter `$exception_message` or `$exception_list`.
2. Add a failing CLI-boundary test whose exception `__str__` raises; the original exception must still be re-raised and a structural event must be captured.
3. Replace free-form exception values with the exception type. Keep the stable fingerprint and bounded CodeAlmanac-only frames.
4. Wrap all exception shaping inside the telemetry best-effort boundary so it cannot replace the product exception.
5. Remove now-unused path/value redaction inputs and helpers from callers.
6. Run the focused telemetry and CLI telemetry tests.

### Task 3: Enforce an outbound property allowlist after the SDK

**Files:**
- Modify: `src/codealmanac/integrations/telemetry/sender.py`
- Test: `tests/test_telemetry_sender.py`

1. Add a failing test that injects an unknown future SDK property in `before_send` and expects it to be removed.
2. Build the hook from `frozenset(event.properties)` after `TelemetryEvent` validation.
3. Replace the denylist with a function that reconstructs `message["properties"]` from only those allowed keys.
4. Verify command and exception event properties survive unchanged while arbitrary SDK context does not.

### Task 4: Persist failure category and expose terminal transition change

**Files:**
- Modify: `src/codealmanac/services/runs/models.py`
- Modify: `src/codealmanac/services/runs/requests.py`
- Modify: `src/codealmanac/services/runs/transitions.py`
- Modify: `src/codealmanac/services/runs/store.py`
- Modify: `src/codealmanac/services/runs/service.py`
- Modify: `src/codealmanac/services/telemetry/service.py`
- Test: `tests/test_runs_service.py`
- Test: `tests/test_run_telemetry.py`

1. Add failing tests that a failed run persists its controlled category and a second finish cannot rewrite a terminal record or append another terminal status event.
2. Add `failure_category` to `RunRecord`; preserve compatibility with older failed records that lack it.
3. Require new failed `FinishRunRequest` values to carry a category and reject categories for non-failed statuses.
4. Add `RunFinishResult(record, changed)` beside the existing cancellation results.
5. Make `finish_run` return `changed=False` for every already-terminal record.
6. Have `RunStore.finish` persist the category and return the neutral result.
7. Have `RunsService` capture lifecycle telemetry only when finish/cancellation actually creates the terminal transition.
8. Make telemetry read `record.failure_category`; keep `internal_error` only as a legacy-record fallback.

### Task 5: Prove opt-out cannot be replayed after re-enable

**Files:**
- Test: `tests/test_run_telemetry.py`

1. Add a failing finish test: opt out, finish, re-enable, retry finish, and assert no event.
2. Add the same sequence for queued cancellation.
3. Add the same sequence for confirmed running cancellation.
4. Run the focused run and telemetry tests after transition gating is implemented.

### Task 6: Classify returned exit code 130 as interrupted

**Files:**
- Modify: `src/codealmanac/cli/execution.py`
- Test: `tests/test_cli_telemetry.py`

1. Add a failing test through the real `jobs attach` dispatch path where the handler catches Ctrl-C and returns `130`.
2. Map returned `130` to telemetry outcome `interrupted`; keep other nonzero codes as `failed`.
3. Assert the event keeps command `jobs`, action `attach`, and exit code `130`.

### Task 7: Update architecture knowledge and verify the PR

**Files:**
- Modify: `almanac/architecture/telemetry.md`
- Modify: `almanac/concepts/run-ledger.md`
- Modify: `almanac/reference/runs/run-states-and-events.md`
- Modify: `docs/plans/2026-07-15-cli-telemetry-live-agreement.md`

1. Document structural exception events, exact outbound allowlisting, persisted failure categories, and first-transition-only capture.
2. Run focused red/green tests for each finding.
3. Run `uv run pytest`, `uv run ruff check .`, `uv run codealmanac validate`, `git diff --check`, and `uv build`.
4. Build and install the final wheel in an isolated environment and smoke import/version/help.
5. Review the full `origin/main...HEAD` diff for privacy and unrelated-file leakage.
6. Commit the review fixes, push PR #36, and wait for GitHub CI.
