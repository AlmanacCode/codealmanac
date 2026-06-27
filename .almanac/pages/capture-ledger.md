---
title: Sync Ledger
summary: >-
  The sync ledger is repo-local sweep state that dedupes transcript absorption, tracks pending
  cursors, and reconciles background job outcomes before advancing cursors.
topics:
  - flows
  - automation
  - storage
  - cli
sources:
  - id: github-issue-11
    type: web
    url: https://github.com/AlmanacCode/codealmanac/issues/11
    retrieved_at: 2026-05-31T00:00:00.000Z
    note: >-
      Reports the repeated capture-sweep Absorb jobs that made transcript-range ownership a cost
      invariant.
  - id: sync-refactor-commit
    type: commit
    rev: 6fc4124bec3da04242077dcd01b26482d6f1126d
    note: >-
      Renamed capture-ledger/capture-sweep code to sync-ledger/sync while preserving legacy ledger
      fallback.
  - id: 2026-05-11-scheduled-quiet-session-capture
    type: file
    path: docs/plans/2026-05-11-scheduled-quiet-session-capture.md
    note: Migrated from legacy files.
  - id: sync
    type: file
    path: src/cli/commands/sync.ts
    note: Migrated from legacy files.
  - id: ledger
    type: file
    path: src/sync/ledger.ts
    note: Migrated from legacy files.
  - id: sweep
    type: file
    path: src/sync/sweep.ts
    note: Migrated from legacy files.
  - id: index
    type: file
    path: src/config/index.ts
    note: Migrated from legacy files.
  - id: records
    type: file
    path: src/stores/jobs/records.ts
    note: Migrated from legacy files.
  - id: types
    type: file
    path: src/jobs/types.ts
    note: Migrated from legacy files.
  - id: sync-test
    type: file
    path: test/sync.test.ts
    note: Migrated from legacy files.
  - >-
    /Users/kushagrachitkara/.codex/sessions/2026/05/11/rollout-2026-05-11T14-32-08-019e18f4-5e73-7790-ba49-73cc02544a58.jsonl
  - >-
    /Users/rohan/.codex/sessions/2026/05/13/rollout-2026-05-13T23-00-06-019e246d-595d-76d3-bd45-6433245065ac.jsonl
  - >-
    /Users/rohan/.codex/sessions/2026/05/28/rollout-2026-05-28T18-27-05-019e70e9-b7d7-7900-9fc0-da2a6f0b532d.jsonl
status: implemented
verified: 2026-06-08T00:00:00.000Z

---

# Sync Ledger

The sync ledger is the repo-local state file that remembers what transcript material CodeAlmanac has already absorbed. In the quiet-session design described by [[capture-automation]], it is the main dedupe and recovery contract for `almanac sync`, not a side detail of the scheduler.

The 2026-05-11 capture discussion made one ownership boundary explicit: platform schedulers such as `launchd` should only wake the CLI. The sweep itself should read, write, and reconcile the ledger. The current implementation keeps that state ownership in [[src/sync/ledger.ts]] and [[src/sync/sweep.ts]], leaving [[src/cli/commands/sync.ts]] as the CLI adapter.

## What it tracks

The ledger answers four questions for each transcript:

- have we seen this transcript before
- through which byte or line cursor was it last absorbed successfully
- is newer unabsorbed content already reserved by a pending background Absorb job
- did the last background job succeed, fail, or go stale

The per-transcript record tracks:

- transcript identity: `app`, `sessionId`, `transcriptPath`
- last successful cursor: `lastAbsorbedSize`, `lastAbsorbedLine`, `lastAbsorbedPrefixHash`, `lastAbsorbedAt`
- job linkage: `lastJobId`
- lifecycle state: `status`
- pending cursor state while a background job is in flight: `pendingToSize`, `pendingToLine`, `pendingPrefixHash`, `pendingJobId`, `pendingStartedAt`
- recovery context when a continuation cannot advance cleanly: `lastError`

This is stronger than whole-file hash dedupe. It lets append-only JSONL transcripts absorb only new continuation while still guarding against rewrites or failed background jobs.

The 2026-05-28 sweep incident made the ledger's ownership role broader than retry bookkeeping. Automatic capture must classify and reserve candidate work before invoking an LLM. The provenance boundary asks whether a transcript is real project work or CodeAlmanac maintenance exhaust such as a prior maintenance run reading another transcript. The current prevention path is provider-session policy: Build, Absorb, and Garden request non-persistent provider sessions, so new maintenance runs should not normally become future sweep input. The ownership boundary asks whether another capture already owns the transcript range; the ledger's pending cursor state reserves that range while the per-wiki operation queue serializes write-capable jobs against the wiki. Issue #11 makes that ordering concrete: repeated sweeps over the same maintenance-derived source can spend substantial model quota even when each individual Absorb job completes normally. [@github-issue-11]

That ordering is the cost invariant. The LLM decides whether claimed project-work evidence contains durable wiki knowledge. Deterministic sweep and ledger code decide whether the evidence is eligible, non-recursive, and unowned before any model tokens are spent.

## Ledger key

The ledger key is explicit transcript identity, not a display name:

```text
<app>:<absolute transcript path>
```

Example:

```text
codex:/Users/example/.codex/sessions/2026/05/11/rollout-abc.jsonl
```

Including `app` keeps parsing/discovery assumptions explicit even if different agent apps someday produce similarly shaped paths or filenames. Using the absolute path is more conservative than a session-id-only key for the first version because it directly identifies the file sweep is reading.

A future migration to a cleaner logical key such as `codex:<session-id>` is plausible once each adapter can trust its session identity and path-stability story. The durable recommendation for v1 is simpler: keep `sessionId` as data inside the entry, but use `app + absolute path` as the ledger key.

## Example record

The session also made the intended shape concrete enough to preserve an example. A plausible ledger entry for one transcript is:

```json
{
  "app": "codex",
  "sessionId": "019e18f4-5e73-7790-ba49-73cc02544a58",
  "transcriptPath": "/Users/example/.codex/sessions/2026/05/11/rollout-...jsonl",
  "status": "pending",
  "lastAbsorbedSize": 182340,
  "lastAbsorbedLine": 742,
  "lastAbsorbedPrefixHash": "sha256:8d5d...",
  "lastAbsorbedAt": "2026-05-11T20:10:00Z",
  "pendingToSize": 196804,
  "pendingToLine": 801,
  "pendingJobId": "job_01jv...",
  "lastJobId": "job_01jv..."
}
```

The important point is the separation between:

- last successfully absorbed cursor
- pending cursor target currently owned by a background job
- run linkage used for reconciliation

## Location

The ledger lives at:

- `.almanac/jobs/sync-ledger.json`

Earlier discussion also floated `.almanac/capture-ledger.json`, but the implementation colocates the ledger with the ignored runtime state already described in [[process-manager-runs]]. `[[src/sync/ledger.ts]]` still reads legacy `.almanac/runs/sync-ledger.json` and `.almanac/runs/capture-ledger.json` when the current `sync-ledger.json` is absent, so old repos keep their cursor history after the command and storage rename.

Repo-local storage matters because capture state belongs to one wiki. Different repos may observe the same user's Claude or Codex transcripts but still need independent dedupe and retry state.

The same 2026-05-11 session also clarified a boundary that should remain outside the ledger: enabling scheduled sync should establish an activation baseline so first-run sweeps ignore older transcript history by default. The ledger should start recording progress from that point forward, not be pre-seeded as if old transcripts had already been absorbed. In other words, "what counts as in scope yet" is automation state, while "how far this repo has successfully absorbed" is ledger state.

The follow-up implementation made that boundary concrete by adding `automation.sync_since` to the global config schema. The scheduler install path records this timestamp once, while the ledger remains repo-local and only records per-transcript progress after transcripts are in scope.

That review also tightened the config contract one step further: the activation boundary is user-level only, not project-configurable. A repo-local override would let one wiki silently redefine the user's global historical sync boundary.

The 2026-05-13 review tightened the first-entry behavior around that boundary. A fresh ledger entry is not always a zero cursor. If the transcript file itself is newer than `automation.sync_since` but some early lines predate that timestamp, the initial cursor starts at the first line whose own timestamp is at or after the activation boundary. If the transcript lacks line timestamps, sweep refuses to guess and treats the file as already covered until later appended content makes a safe continuation boundary visible.

`almanac sync status` is intentionally read-only with respect to ledger state. The sweep still computes eligibility against any existing ledger entries, but it should not create `.almanac/jobs/sync-ledger.json` or advance cursors when the user is only previewing work.

## Update timing

The lifecycle is:

1. `almanac sync` discovers a transcript and maps it to a repo.
2. The sweep reads that repo's ledger entry before deciding eligibility.
3. For an append-only transcript with new unabsorbed content, the sweep starts a normal Absorb job using the original full transcript path plus cursor context describing what was already absorbed.
4. When that job is enqueued, the sweep records pending cursor targets and `pendingJobId`.
5. A later sweep reconciles the pending entry against `.almanac/jobs/<job-id>.json`.
6. Only after a successful job does the sweep promote the pending cursor into the durable `lastAbsorbed*` fields.

That two-phase model matters because [[capture-flow]] starts background jobs asynchronously. A sweep can know that work was queued, but it cannot safely claim the new transcript continuation was captured until the run record says it finished successfully.

The same discussion also clarified how scheduled sync bridges into Absorb. Current `almanac sync` hands Absorb the original full transcript path, not byte ranges or cursor-aware slices. Later turns in the same session replaced the earlier delta-file sketch with a cleaner v1 posture: keep passing the original transcript path, but include cursor instructions such as "already absorbed through line 812 / byte 184203; focus on later material unless earlier lines are needed for context." That keeps the ledger as the source of truth for what was processed without creating temp sliced transcripts. [@sync-refactor-commit]

The review pass that followed the design discussion tightened this boundary in code. `executeSyncSweep()` writes the updated pending ledger entry immediately after an Absorb job is successfully enqueued, rather than waiting until the end of the sweep. That keeps the conceptual two-phase model aligned with the persisted state: once a run id exists, the repo ledger records that pending ownership right away.

One later operator-facing clarification from the same Codex transcript is worth preserving because the launchd logs can look misleading at first glance. Repeated sync runs against the same transcript path do not mean sync discovered several distinct sessions. They usually mean one append-only transcript became quiet again after more lines were added past the last successful cursor. In that case the new job is a continuation Absorb run for the same `app + transcriptPath` ledger key, and the new run should focus only on lines after `lastAbsorbedLine` unless earlier lines are needed for context.

## How sweep uses it

The later "show me the ledger example, and how we will be using it" exchange made the operational order explicit:

1. Scan Claude and Codex transcript locations.
2. For each transcript, recover the session cwd or repo hint from the transcript metadata.
3. Walk upward from that cwd to find the nearest `.almanac/`.
4. Ignore transcripts that do not map to a repo with an initialized wiki.
5. For each remaining candidate, read the repo-local ledger entry.
6. Use the ledger to decide whether the transcript is new, already absorbed through a cursor, already owned by a pending Absorb run, or in a `needs_attention` state that should not advance automatically.
7. Only enqueue Absorb for newly eligible unabsorbed content.

This means transcripts are the discovery surface, `.almanac/` determines whether CodeAlmanac should care, and the ledger determines whether there is any new material worth absorbing.

The same Codex transcript later clarified one operator-facing point that is easy to misread from launchd logs: sync does not start Absorb merely because it rediscovered a transcript path. A candidate is only eligible after all earlier gates passed and the file has advanced beyond the ledger cursor. In current code that means the transcript mapped to a repo with `.almanac/`, survived the `automation.sync_since` cutoff, stayed quiet for the configured window, was not already owned by a pending run, and still had `currentSize > lastAbsorbedSize`. A quiet transcript with no new bytes is skipped as `unchanged`, not reabsorbed.

## Status model

The implemented ledger states are:

- `done`: the last successful cursor is authoritative; fresh entries also start here at the zero cursor
- `pending`: the sweep already enqueued a background Absorb run and reserved `pendingTo*` cursor bounds for it
- `failed`: the last attempted continuation did not finish successfully and is retryable from the last successful cursor
- `needs_attention`: the transcript no longer matches the stored prefix cursor, so automatic continuation is unsafe until a human or future repair path decides what to do

This distinction matters because `queued` and `running` are job-record states under [[process-manager-runs]], not ledger states. The ledger collapses all in-flight ownership into `pending`, then learns whether that pending job finished by reconciling against the background job record on a later sweep.

The preferred v1 posture was to keep pending bounds separate until success is confirmed. The simpler alternative, advancing the cursor as soon as a job is queued, was rejected as too likely to lose retryability after failures.

## Reconciliation

At the start of every sweep, any ledger entry whose status is `pending` should be reconciled against its job record under [[process-manager-runs]]:

1. Read `.almanac/jobs/<job-id>.json`.
2. If the job record is still `queued` or `running`, keep the ledger entry `pending` and skip enqueuing another Absorb job for that transcript.
3. If the job is `done`, promote `pendingToSize`, `pendingToLine`, and related pending metadata into the durable `lastAbsorbed*` fields.
4. If the job is `failed`, `cancelled`, or `stale`, preserve the last successful cursor and mark the transcript retryable.

This is the most important invariant on the page: CodeAlmanac should not claim "captured through byte X / line Y" until the job that absorbed that transcript prefix finished successfully.

## Relationship to hooks

Earlier discussion treated app lifecycle hooks as a likely optional fast path beside scheduled sweep, but the implemented v1 stance is scheduler-only automatic session sync. Hook-based auto-capture was removed from onboarding and the public command surface.

That makes the ledger the state model for scheduled sweep, not a neutral compromise between two equally first-class automation systems.

The durable recommendation from the later session state is:

- let the ledger be the repo-local source of truth for sync progress
- let `almanac sync` remain the authoritative owner of cursor semantics
- keep automatic session syncing scheduler-only so no hook path bypasses the ledger

Future edits should preserve one subtle distinction here: "scheduler-only" removed hook bypasses at the product level, but duplicate prevention still depends on both the ledger and repo-local sweep locking. The current implementation uses `.almanac/jobs/sync.lock` plus early pending-entry writes so overlapping sweeps skip busy repos instead of racing to enqueue the same continuation twice.

That lock layer also has its own recovery contract now. The lock is a directory containing `owner.json` with the sweep pid and start time. A later sweep treats the lock as stale when the owner metadata is missing, the timestamp is too old, or the recorded pid is no longer alive; in those cases it removes the abandoned lock and proceeds. A healthy in-process sweep still causes `sweep-already-running` for that repo.
