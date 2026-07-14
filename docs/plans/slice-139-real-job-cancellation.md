# Slice 139 — Real Job Cancellation

**Date:** 2026-07-10

## Goal

Make `codealmanac jobs cancel <run-id>` stop a running job and its agent,
instead of only changing the recorded SQLite status.

After successful cancellation:

- no executor or harness process for the run remains alive;
- the run is durably `cancelled`;
- `jobs attach` has a truthful terminal event;
- remaining queued work continues normally.

## Problem Today

The current cancel path only updates the run ledger:

```python
record = store.read(run_id)
cancelled = cancel_run(record, now)
store.update_record_preserving_spec(cancelled)
event_store.append_status(run_id, now, "cancelled")
```

This is sufficient for queued work because queue selection only reads rows with
`status = 'queued'`. It is not sufficient after execution begins. The worker
does not re-read cancellation state and no signal is sent to the worker or
harness process.

The resulting contradiction is:

```text
SQLite: cancelled
worker: still running
agent:  still editing or committing
```

Codex also starts its app-server with `start_new_session=True`. A process-group
signal sent only to the current worker does not reach that child. A controlled
local reproduction confirmed that the child remains alive after the worker
group exits.

## Architecture Flag

The current worker has two responsibilities:

1. manage and drain the queue;
2. execute a lifecycle run inline.

That shape cannot support honest cancellation cleanly. Killing it interrupts
queue management, and killing its process group does not reliably contain
harness descendants.

Reshape the runtime before adding cancellation:

```text
detached queue worker
    |
    | selects one queued run
    v
one-run executor process
    |
    +-- Build / Ingest / Garden workflow
    |
    `-- Codex or Claude harness process tree
```

The queue worker remains the serialized queue manager. Each run gets a separate,
identifiable executor process that can be terminated without killing the queue
manager.

## Scope

### In scope

- Extract one-run dispatch from `RunQueueWorker` into a `RunExecutor`.
- Add a hidden `__run-executor <run-id>` process entrypoint.
- Make the queue worker spawn and wait for one executor at a time.
- Persist a typed execution reference when a run becomes `running`.
- Make queued-to-running claim atomic with execution-reference persistence.
- Add a process-controller port and local adapter.
- Request, perform, confirm, and durably finalize running cancellation.
- Preserve queued cancellation and terminal no-op behavior.
- Keep Codex and Claude descendants inside the cancellable execution contract.
- Keep the queue worker alive so it can continue with remaining work.
- Update CLI output, README, active agreement, known-bug record, and Almanac
  pages after the behavior is real.

### Out of scope

- Rolling back edits or commits completed before cancellation.
- Pausing or resuming jobs.
- Retrying cancelled jobs.
- A hosted or remote job controller.
- Public access to `__run-worker` or `__run-executor`.
- A general-purpose process manager unrelated to lifecycle runs.
- Adding a public `cancelling` status.

## Product Contract

| Starting state | `jobs cancel` behavior |
| --- | --- |
| `queued` | Atomically mark `cancelled`; the executor must never claim it. |
| `running` | Record cancellation intent, terminate the matching executor tree, confirm it stopped, then mark `cancelled`. |
| `done`, `failed`, `cancelled` | No-op with the existing terminal result. |
| termination unconfirmed | Return nonzero, record an error event, and do not claim the run is cancelled. |

Cancellation stops future execution. Existing working-tree changes and existing
commits remain visible and untouched.

## Design Decisions

### 1. Queue management and run execution become separate processes

Keep `__run-worker` as the detached queue manager. It owns the worker lock,
selects the oldest queued run, starts one executor, waits for it, reconciles the
result, and continues.

Add `__run-executor <run-id>` as a hidden process entrypoint. It executes exactly
one durable `RunSpec` and exits.

This restores the clean split already anticipated by
`docs/python-port/slice-75-run-queue-core.md`: the queue selects work; an
executor runs one job.

### 2. Cancellation is a queue workflow use case

The CLI must call `app.workflows.queue.cancel(...)`, not
`app.runs.cancel(...)` directly.

`RunsService` continues to own durable transitions. `RunQueue` coordinates the
product verb across two mechanisms:

```python
result = queue.cancel(
    CancelQueuedRunRequest(run_id=run_id),
    process_controller,
)
```

The exact request name can change during implementation, but the ownership may
not drift into CLI dispatch or the SQLite store.

The service-layer reference says the service layer exists to orchestrate
workflows and define use cases: “The service layer will become the main way into
our app”
[`chapter_04_service_layer.md`](../reference/cosmic-python/chapter_04_service_layer.md).

### 3. Execution identity is durable and verified

Add a typed execution reference to a running record:

```python
class RunExecutionRef(CodeAlmanacModel):
    execution_id: str
    pid: int
    process_started_at: datetime
```

- `execution_id` distinguishes logical executor attempts.
- `pid` identifies the local executor.
- `process_started_at` protects against signaling a reused PID.
- The local adapter must verify both PID and process birth time before signaling.
- Terminal records may retain the reference for diagnosis, but controllers only
  act on a matching active execution.

Use a mature process library for cross-platform PID birth-time, child-tree,
wait, and escalation behavior rather than hand-rolled `ps` parsing. The
implementation plan must pin and justify that dependency before coding the
adapter.

### 4. Claiming a run is atomic

Today, reading a queued record and writing `running` are separate operations.
That permits a cancel/claim race.

Add one store transaction or compare-and-swap operation that succeeds only when
the row is still queued:

```text
queued + matching run id
    -> running + started_at + execution_ref + running event
```

If queued cancellation wins first, executor claim fails and the executor exits
without invoking a lifecycle workflow.

The Unit of Work reference describes the desired boundary as one that
“succeeds or fails as a block”
[`chapter_06_uow.md`](../reference/cosmic-python/chapter_06_uow.md).

### 5. Cancellation intent is non-terminal state, not a new status

Do not write `cancelled` before termination. Also do not add a public
`cancelling` state machine.

Persist a small fact on the running record:

```python
cancellation_requested_at: datetime | None
```

The sequence is:

```python
run = runs.request_cancellation(run_id)
processes.terminate(run.execution)
processes.require_stopped(run.execution)
latest = runs.show(run_id)
return runs.finish_cancellation(latest, expected_execution_id)
```

`request_cancellation` appends a non-terminal message event. Only
`finish_cancellation` appends the terminal `cancelled` status event.

This intent fact also handles a controller crash: if the executor exits while
cancellation is requested, the queue worker can safely reconcile it as
cancelled instead of failed.

### 6. Termination is graceful, bounded, and confirmed

The process controller must:

1. verify the execution identity;
2. prevent the executor from starting additional work;
3. request graceful termination;
4. wait for a short bounded grace period;
5. terminate the complete descendant tree;
6. force-kill survivors;
7. confirm the executor and descendants are gone.

If any process cannot be confirmed stopped, cancellation returns an error and
must not append the terminal cancelled event.

### 7. Harness containment is a required contract

The one-run executor is not sufficient if a provider escapes it.

- Remove Codex's unnecessary extra process session, or explicitly register and
  terminate its app-server child through the controller.
- Verify how `claude-agent-sdk` creates and closes its CLI subprocess.
- Add provider contract tests proving executor cancellation leaves no provider
  child alive.
- Keep each adapter's normal `finally` cleanup; forced tree termination is the
  last-resort safety net, not the only cleanup mechanism.

Do not land real cancellation for one provider while silently leaving the other
provider able to escape.

### 8. Executor exit is reconciled by recorded facts

After the executor exits, the queue worker reads the latest record:

- terminal record: continue;
- cancellation requested and executor dead: wait briefly for the controller's
  confirmed terminal write; do not infer cancellation from root-process exit;
- cancellation intent without a confirmed terminal write after that wait:
  record an error, leave the run non-terminal, and stop draining so unknown
  descendants cannot overlap the next job;
- still running without cancellation intent: mark failed with “executor exited
  without a terminal result”;
- still queued: claim never succeeded; continue.

After ordinary confirmed cancellation, the queue worker remains alive and can
immediately select the next queued job. No replacement worker is needed.

## Proposed Runtime Flow

```python
# queue manager
while queued := runs.next_queued():
    child = executors.spawn(queued.record.run_id)
    child.wait()
    reconcile_executor_exit(queued.record.run_id, child)

# one-run executor
execution = process_identity.current()
claimed = runs.claim(run_id, execution)
if not claimed:
    return
run_executor.execute(claimed)

# public cancellation
run = runs.request_cancellation(run_id)
if run.was_queued:
    return run.cancelled
processes.terminate_and_wait(run.execution)
return runs.finish_cancellation(run.run_id, run.execution.execution_id)
```

## Persistence And Concurrency

- Keep runs, specs, events, and locks in
  `~/.codealmanac/codealmanac.db`.
- Do not add PID files, cancellation marker files, per-run JSON, or a second
  queue representation.
- Make `claim`, queued cancellation, cancellation request, and cancellation
  finalization conditional transitions in SQLite.
- Keep denormalized `runs.status` and `record_json.status` synchronized within
  the same transaction.
- Make event append part of the same owned store operation where practical. If
  the current event store prevents true atomicity, reshape it rather than
  accepting a status/event split.
- Require the expected `execution_id` when finalizing running cancellation so a
  stale controller cannot cancel a newer execution attempt.

## Exact File Changes

### Run ledger

- `src/codealmanac/services/runs/models.py`
  - add `RunExecutionRef`;
  - add optional execution and cancellation-request facts to `RunRecord`;
  - extend cancellation results without breaking human/JSON meaning.
- `src/codealmanac/services/runs/requests.py`
  - add typed claim, request-cancellation, and finish-cancellation requests.
- `src/codealmanac/services/runs/transitions.py`
  - separate queued cancellation, cancellation request, and confirmed finish;
  - keep terminal transitions monotonic.
- `src/codealmanac/services/runs/store.py`
  - implement conditional transactional transitions and exit reconciliation.
- `src/codealmanac/services/runs/events.py`
  - participate in the same connection/transaction where required.
- `src/codealmanac/services/runs/service.py`
  - expose the durable operations without importing process machinery.

### Queue and executor workflows

- `src/codealmanac/workflows/run_queue/worker.py`
  - retain lock and drain ownership;
  - replace inline lifecycle execution with spawn/wait/reconcile.
- `src/codealmanac/workflows/run_queue/executor.py`
  - new one-run dispatcher extracted from today's `execute_queued` logic.
- `src/codealmanac/workflows/run_queue/ports.py`
  - own executor-spawner and process-controller contracts.
- `src/codealmanac/workflows/run_queue/requests.py`
  - add execute-one and cancel use-case requests.
- `src/codealmanac/workflows/run_queue/service.py`
  - coordinate public cancellation and executor spawning.

### Process integrations and composition

- `src/codealmanac/integrations/runs/process.py`
  - keep detached queue-worker spawning;
  - add one-run executor spawning, verified tree termination, wait, and
    escalation.
- `src/codealmanac/integrations/harnesses/codex/rpc.py`
  - remove or account for the separate app-server session.
- `src/codealmanac/integrations/harnesses/claude/client.py`
  - make cancellation cleanup explicit if SDK unwinding is insufficient.
- `src/codealmanac/app.py`
  - wire ports and adapters in the composition root.

The dependency-injection reference calls this wiring location the “composition
root”
[`chapter_13_dependency_injection.md`](../reference/cosmic-python/chapter_13_dependency_injection.md).

### CLI

- Add hidden parser/dispatch support for `__run-executor <run-id>`.
- Route `jobs cancel` through `app.workflows.queue.cancel(...)`.
- Preserve current human and JSON terminal/no-op shapes where they remain true.
- Return nonzero with an actionable error when termination is unconfirmed.

### Documentation

- `README.md`: describe cancel as stopping queued or running work after the
  behavior exists.
- `docs/python-port-live-agreement.md`: replace ledger-only cancellation with
  the confirmed-execution contract.
- `docs/bugs/codealmanac-known-bugs.md`: close the deferred running-cancel bug.
- `almanac/concepts/run-ledger.md`
- `almanac/architecture/lifecycle/run-queue-and-sync.md`
- `almanac/reference/runs/run-states-and-events.md`
- `almanac/guides/debug-a-failed-lifecycle-run.md`

## Tests

### Service/store tests

- queued cancellation is terminal and prevents claim;
- claim wins versus cancel without overwriting either transition;
- running cancellation request is non-terminal;
- confirmed cancellation requires the expected execution ID;
- terminal runs remain no-ops;
- finish and cancel races preserve the actual winner;
- status and terminal event cannot diverge;
- unsafe or stale execution references are rejected.

### Queue workflow tests

- worker spawns one executor per run and waits;
- cancelled queued work never invokes a lifecycle workflow;
- cancelled executor does not stop the queue manager;
- next queued run starts after cancellation;
- unexpected executor death becomes failed;
- requested cancellation plus executor death waits for confirmed cancellation;
- worker lock is still released on manager failure.

### Process adapter tests

- verified executor terminates gracefully;
- grace timeout escalates to force kill;
- descendant processes are terminated recursively;
- child in a separate session cannot survive;
- PID reuse/birth-time mismatch is never signaled;
- already-exited processes are handled as a race, not a false error;
- every spawned test process is cleaned up in `finally`.

### Provider containment tests

- Codex app-server exits when its executor is cancelled;
- Claude SDK CLI exits when its executor is cancelled;
- no post-cancellation harness events or filesystem writes occur;
- auto-commit instructions cannot be acted on after confirmed cancellation.

### CLI tests

- queued cancel prints a truthful success;
- running cancel waits for confirmed termination;
- failed termination returns nonzero and never prints `cancelled`;
- terminal cancel remains a no-op;
- `jobs attach` exits only after the terminal cancelled event;
- JSON output distinguishes success, no-op, and control failure.

## Verification

Focused gates:

```bash
uv run pytest tests/test_runs_service.py tests/test_run_queue_workflow.py \
  tests/test_cli.py tests/test_architecture.py
uv run ruff check src/codealmanac/services/runs \
  src/codealmanac/workflows/run_queue src/codealmanac/integrations/runs \
  src/codealmanac/cli tests
```

Real provider dogfood:

1. Start a long-running Codex job in a disposable repository.
2. Cancel it while running.
3. Confirm the executor and Codex app-server PIDs are gone.
4. Confirm no files change after the command reports success.
5. Repeat with Claude.
6. Queue a second job and prove it starts after the first is cancelled.

Broad gates:

```bash
uv run pytest
uv run ruff check .
codealmanac validate
git diff --check
```

## Review Requirements

After implementation, run the repository code-review prompt from
`.claude/agents/review.md`. Classify findings as must-fix, should-fix, or
consider, then write `docs/plans/fixes-slice-139-review.md` before applying
review fixes.

Must-fix review questions:

- Can any successful cancel leave a worker, executor, Codex, Claude, or tool
  subprocess alive?
- Can a stale PID or execution reference signal an unrelated process?
- Can SQLite say cancelled before termination is confirmed?
- Can claim and cancellation overwrite each other?
- Can cancelling one run prevent later queued work from executing?
- Can status and terminal log events disagree?

## Acceptance Criteria

The slice is complete only when this statement is true:

> After `codealmanac jobs cancel <run-id>` returns success for a running job,
> SQLite records a terminal cancelled event and no process belonging to that
> execution remains alive.

## Read Before Coding

- `MANUAL.md`
- `docs/python-port-live-agreement.md`
- `docs/python-port/slice-74-jobs-control.md`
- `docs/python-port/slice-75-run-queue-core.md`
- `docs/python-port/slice-76-background-worker-spawn.md`
- `docs/reference/cosmic-python/chapter_04_service_layer.md`
- `docs/reference/cosmic-python/chapter_06_uow.md`
- `docs/reference/cosmic-python/chapter_13_dependency_injection.md`
- `almanac/concepts/run-ledger.md`
- `almanac/architecture/lifecycle/run-queue-and-sync.md`
- `almanac/reference/runs/run-states-and-events.md`
- `docs/bugs/codealmanac-known-bugs.md`
- `archive/code/src/jobs/{worker,executor,finalization}.ts` as behavior history,
  not current architecture truth.
