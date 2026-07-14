# Slice 142 — Atomic Worker Idle Handoff

**Date:** 2026-07-11

## Goal

Prevent durable queued runs from being stranded when they arrive as the active
queue worker is deciding that the queue is empty and releasing its global lock.

## Problem Today

The worker performs these persistence operations separately:

```python
queued = runs.next_queued()
if queued is None:
    break
finally:
    lease.release()
```

A producer can insert a queued run after `next_queued()` returns `None`, spawn a
second worker that loses the still-held lock, and then watch the first worker
release the lock and exit. The queued run has no remaining wakeup.

## Architecture Fit

This is one atomic persistence operation, not retry machinery and not a new
worker lifecycle. The run service exposes the product verb, the run store
delegates persistence, and the worker-lock store owns the transaction that
rechecks queue membership and changes lock ownership.

The Unit of Work reference describes the property needed here as “A stable
snapshot of the database” and “a way to persist all of our changes at once”
[`chapter_06_uow.md`](../reference/cosmic-python/chapter_06_uow.md).

```python
queued = runs.next_queued()
if queued is None:
    outcome = runs.release_worker_if_idle(lease.owner)
    if outcome is WORK_AVAILABLE:
        continue
    break
```

The repository boundary keeps SQLite transaction details out of the workflow.
The repository reference describes its purpose as “hiding the complexities of
the database”
[`chapter_02_repository.md`](../reference/cosmic-python/chapter_02_repository.md).

## Scope

### In scope

- Add a typed idle-handoff outcome.
- Add a service request carrying the current lock owner.
- In one `BEGIN IMMEDIATE` transaction:
  - verify that the caller still owns the worker lock;
  - recheck the exact durable queue-membership predicate;
  - keep the lock when work exists, or delete it when the queue is empty.
- Continue draining if work appeared during the old empty-to-release window.
- Make worker lock check-and-claim explicitly transactional too.
- Add persistence and workflow regression tests.
- Update the run-queue Almanac page after verification.

### Out of scope

- Persistent daemon workers.
- Polling, sleeps, retries, or a notification channel.
- Multiple concurrent queue consumers.
- Changing FIFO queue selection.
- Changing explicit `max_runs` behavior; a bounded drain releases normally
  when its requested limit is reached.

## Transaction Ordering

Both run insertion and idle handoff use `BEGIN IMMEDIATE` on the same SQLite
database.

```text
handoff transaction first
    -> confirms empty and deletes lock
    -> producer inserts run and its spawned worker acquires the free lock

producer transaction first
    -> inserts run
    -> handoff sees work and retains the lock
    -> active worker continues draining
```

There is no committed state in which a producer has queued work, its spawned
worker has lost the lock, and the lock owner has already committed an empty
handoff.

## Tests

- Idle handoff releases the lock when no queued spec exists.
- Idle handoff retains the lock and reports work when a queued spec exists.
- A queued run inserted at the worker's empty-handoff seam is processed by the
  current drain rather than stranded.
- A bounded `max_runs` drain still stops after its requested count.
- Run focused tests, full pytest, Ruff, and the architecture suite.
