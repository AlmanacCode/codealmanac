# CLI Telemetry Third Review Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close the three reproduced privacy, terminal-transition, and provider-classification findings without coupling durable run specs to a changing model catalog.

**Architecture:** The typed telemetry boundary validates the harness/model pair against the central controlled catalog and drops unknown values. Operation failure recording treats the failed transition as authoritative and the readable error event as independent best effort. Harness readiness and provider invocation become separate service calls, with event-sink failures typed so internal persistence errors cannot be mistaken for provider failures.

**Tech Stack:** Python 3.12+, Pydantic models, SQLite run ledger, pytest, Ruff, uv.

---

## Review verdicts

1. **Accept the privacy bug; reject catalog validation in durable `RunSpec`.** Historical queued specs must remain readable when the controlled catalog changes. `LifecycleRunCompletedProperties` will validate the harness/model pair against `HARNESS_MODELS`, causing `capture_lifecycle` to fail closed before event construction.
2. **Accept the authoritative-transition bug.** A readable error event and the terminal run write are separate effects. A safe shared error summary will be computed once; error-event persistence and `runs.finish(...)` will each receive their own best-effort boundary.
3. **Accept the provider-classification bug and split the contract.** `HarnessesService.ensure_ready(...)` owns readiness; `run_ready(...)` invokes the already-approved adapter. A typed sink wrapper distinguishes caller event-persistence failures from adapter failures occurring during the same call.

### Task 1: Reject unknown lifecycle models at the telemetry boundary

**Files:**
- Modify: `src/codealmanac/services/telemetry/models.py`
- Test: `tests/test_run_telemetry.py`
- Test: `tests/test_telemetry_service.py`

1. Add a failing lifecycle test whose valid queued `RunSpec` contains path/secret-like model text.
2. Complete the run and assert the recording sender receives no lifecycle event.
3. Add a model-level mismatch test using a controlled model with the wrong harness.
4. Validate `LifecycleRunCompletedProperties.model` against `HARNESS_MODELS[HarnessKind(harness)]` in the existing model validator.
5. Run the focused telemetry tests and confirm both pass.

### Task 2: Preserve the authoritative failed transition when event logging fails

**Files:**
- Modify: `src/codealmanac/core/errors.py`
- Modify: `src/codealmanac/workflows/operations/service.py`
- Test: `tests/test_ingest_workflow.py`

1. Add a failing test that begins an operation, makes `OperationRunner.record(...)` raise, calls `fail(..., SOURCE_PREPARATION)`, and expects a durable failed record with the original category.
2. Add a failing test whose exception `__str__` raises and expect the same durable failed transition with the exception type as its safe message.
3. Make `error_summary(...)` return the exception type when stringification fails.
4. Replace the shared suppression block in `OperationRunner.fail(...)` with one block for the readable error event and a separate block for `runs.finish(...)`.
5. Run the focused workflow tests.

### Task 3: Separate readiness, provider invocation, and event-sink failure

**Files:**
- Modify: `src/codealmanac/services/harnesses/service.py`
- Modify: `src/codealmanac/workflows/operations/service.py`
- Test: `tests/test_harnesses_service.py`
- Test: `tests/test_build_workflow.py`

1. Add a failing build workflow test whose adapter is ready but raises during `run`; expect `provider_execution`.
2. Add a failing test whose live event sink raises; expect `internal_error`, not provider execution.
3. Add `HarnessEventSinkFailed` carrying the original sink exception.
4. Keep `ensure_ready(...)` as the readiness verb and replace combined `run(...)` with `run_ready(...)`, which calls only the selected adapter and wraps sink failures.
5. In `OperationRunner.execute(...)`, run readiness and provider invocation in separate try/except blocks. Map readiness exceptions to `harness_readiness`, sink exceptions to `internal_error`, and adapter exceptions to `provider_execution`.
6. Preserve normalized failed-result validation as `provider_execution`.
7. Run focused harness, build, ingest, and garden tests.

### Task 4: Update living architecture and verify PR #36

**Files:**
- Modify: `almanac/architecture/telemetry.md`
- Modify: `almanac/architecture/agent-runs/harness-contract.md`
- Modify: `almanac/architecture/lifecycle/operation-runner.md`
- Modify: `docs/python-port-live-agreement.md`
- Modify: `docs/plans/2026-07-15-cli-telemetry-live-agreement.md`

1. Document controlled model fail-closed behavior, independent failure writes, and the split harness contract.
2. Run `uv run pytest`, `uv run ruff check .`, `uv run codealmanac validate`, and `git diff --check`.
3. Run the full suite on Python 3.13.
4. Build/install the wheel and smoke version/config/model validation with telemetry disabled.
5. Update the PR validation count, commit only planned files, push, and wait for all GitHub checks.
