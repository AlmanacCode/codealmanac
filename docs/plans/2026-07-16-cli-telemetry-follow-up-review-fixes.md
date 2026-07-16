# CLI Telemetry Follow-up Review Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close the two validated follow-up findings without leaking run specs into public results or retaining heuristic failure classification.

**Architecture:** Durable run transitions stay authoritative even if every telemetry-only step fails. Operation failure categories come from the explicit workflow phase that failed, with one typed harness-unavailable error distinguishing readiness from provider execution and a new `source_preparation` category for ingest source resolution/runtime.

**Tech Stack:** Python 3.12+, Pydantic models, SQLite run ledger, pytest, Ruff, uv.

---

## Review verdicts

1. **Accept the P1 behavior, reject adding `RunSpec` to transition results.** The reproduced `read_spec` failure makes `RunsService.finish` raise after the durable commit. Returning the source-bearing spec through cancellation result models risks widening public JSON and couples product transitions to telemetry. A RunsService helper will instead wrap the complete telemetry-only read-and-capture path.
2. **Accept the P2 behavior, reject more exception/traceback guessing.** `ExecutionFailed` spans readiness and provider execution; `ValidationFailed` spans source input and final wiki validation. The workflow already knows the active phase, so it will persist that phase explicitly. This follows the service-layer role of “orchestrating our workflows” in `docs/reference/cosmic-python/chapter_04_service_layer.md` and keeps the durable commit authoritative as described in `docs/reference/cosmic-python/chapter_06_uow.md`.

### Task 1: Make terminal telemetry completely best effort

**Files:**
- Modify: `src/codealmanac/services/runs/service.py`
- Modify: `src/codealmanac/services/telemetry/service.py`
- Test: `tests/test_run_telemetry.py`

1. Add failing finish, queued-cancellation, and running-cancellation tests that make the telemetry-only `read_spec` call raise after the store transition.
2. Assert each service call returns normally and the durable terminal status remains visible.
3. Add one RunsService helper that catches both `store.read_spec(...)` and `telemetry.capture_lifecycle(...)` failures.
4. Route all three terminal capture sites through the helper.
5. Wrap lifecycle event shaping inside TelemetryService's own best-effort boundary so direct callers cannot observe shaping failures.
6. Run `uv run pytest tests/test_run_telemetry.py -q`.

### Task 2: Replace heuristic failure classification with explicit phases

**Files:**
- Modify: `src/codealmanac/services/harnesses/service.py`
- Modify: `src/codealmanac/services/runs/models.py`
- Modify: `src/codealmanac/services/telemetry/models.py`
- Modify: `src/codealmanac/workflows/operations/service.py`
- Modify: `src/codealmanac/workflows/build/service.py`
- Modify: `src/codealmanac/workflows/ingest/service.py`
- Modify: `src/codealmanac/workflows/garden/service.py`
- Test: `tests/test_harnesses_service.py`
- Test: `tests/test_build_workflow.py`
- Test: `tests/test_ingest_workflow.py`
- Test: `tests/test_garden_workflow.py`

1. Add a failing unavailable-harness workflow test that expects persisted `harness_readiness`.
2. Add a failing invalid-ingest-source test that expects persisted `source_preparation`.
3. Add `HarnessUnavailable` as a typed `ExecutionFailed` subtype emitted only by failed readiness checks.
4. Add `SOURCE_PREPARATION = "source_preparation"` to the durable category enum and typed telemetry allowlist.
5. Make `OperationRunner.fail(...)` require an explicit category.
6. Add `OperationRunner.failure_phase(...)`, which records the supplied category and re-raises the original error.
7. Make shared execution own its phase boundaries: readiness/provider execution, run-event persistence, indexing, final wiki validation, and terminal completion.
8. Make build, ingest, and garden wrap only their operation-specific preparation phases; do not catch and re-fail errors already owned by `OperationRunner.execute`.
9. Delete `operation_failure_category(...)` and traceback-module inference.
10. Run the focused harness and workflow tests.

### Task 3: Update living architecture and verify PR #36

**Files:**
- Modify: `almanac/architecture/telemetry.md`
- Modify: `almanac/architecture/lifecycle/operation-runner.md`
- Modify: `almanac/architecture/lifecycle/workflows.md`
- Modify: `almanac/concepts/run-ledger.md`
- Modify: `docs/plans/2026-07-15-cli-telemetry-live-agreement.md`

1. Document the complete best-effort telemetry boundary and explicit failure-phase ownership.
2. Update the PR description's test count if it still says 534.
3. Run `uv run pytest`, `uv run ruff check .`, `uv run codealmanac validate`, and `git diff --check`.
4. Build and install the wheel in an isolated environment and run version/config smokes.
5. Commit and push only the planned files, then wait for all PR checks and confirm mergeability.
