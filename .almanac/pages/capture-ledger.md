---
title: Capture Ledger
summary: The capture ledger is repo-local sweep state that dedupes transcript capture, tracks pending cursors, and reconciles background job outcomes before advancing cursors.
topics: [flows, automation, storage, cli]
files:
  - docs/plans/2026-05-11-scheduled-quiet-session-capture.md
  - src/commands/capture-sweep.ts
  - src/update/config.ts
  - src/process/records.ts
  - src/process/types.ts
  - test/capture-sweep.test.ts
sources:
  - /Users/kushagrachitkara/.codex/sessions/2026/05/11/rollout-2026-05-11T14-32-08-019e18f4-5e73-7790-ba49-73cc02544a58.jsonl
status: implemented
verified: 2026-05-12
---

# Capture Ledger

The capture ledger is the repo-local state file that remembers what transcript material CodeAlmanac has already absorbed. In the quiet-session design described by [[capture-automation]], it is the main dedupe and recovery contract for `almanac capture sweep`, not a side detail of the scheduler.

The 2026-05-11 capture discussion made one ownership boundary explicit: platform schedulers such as `launchd` should only wake the CLI. The sweep itself should read, write, and reconcile the ledger.

## What it tracks

The ledger answers four questions for each transcript:

- have we seen this transcript before
- through which byte or line cursor was it last captured successfully
- is newer uncaptured content already reserved by a pending background capture
- did the last background run succeed, fail, or go stale

The per-transcript record tracks:

- transcript identity: `app`, `sessionId`, `transcriptPath`
- last successful cursor: `lastCapturedSize`, `lastCapturedLine`, `lastCapturedPrefixHash`, `lastCapturedAt`
- run linkage: `lastRunId`
- lifecycle state: `status`
- pending cursor state while a background run is in flight: `pendingToSize`, `pendingToLine`, `pendingPrefixHash`, `pendingRunId`, `pendingStartedAt`
- recovery context when a continuation cannot advance cleanly: `lastError`

This is stronger than whole-file hash dedupe. It lets append-only JSONL transcripts capture only new continuation while still guarding against rewrites or failed background jobs.

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
  "lastCapturedSize": 182340,
  "lastCapturedLine": 742,
  "lastCapturedPrefixHash": "sha256:8d5d...",
  "lastCapturedAt": "2026-05-11T20:10:00Z",
  "pendingToSize": 196804,
  "pendingToLine": 801,
  "pendingRunId": "run_01jv...",
  "lastRunId": "run_01jv..."
}
```

The important point is the separation between:

- last successfully absorbed cursor
- pending cursor target currently owned by a background run
- run linkage used for reconciliation

## Location

The ledger lives at:

- `.almanac/runs/capture-ledger.json`

Earlier discussion also floated `.almanac/capture-ledger.json`, but the implementation colocates the ledger with the ignored runtime state already described in [[process-manager-runs]].

Repo-local storage matters because capture state belongs to one wiki. Different repos may observe the same user's Claude or Codex transcripts but still need independent dedupe and retry state.

The same 2026-05-11 session also clarified a boundary that should remain outside the ledger: enabling scheduled auto-capture should establish an activation baseline so first-run sweeps ignore older transcript history by default. The ledger should start recording progress from that point forward, not be pre-seeded as if old transcripts had already been captured. In other words, "what counts as in scope yet" is automation state, while "how far this repo has successfully captured" is ledger state.

The follow-up implementation made that boundary concrete by adding `automation.capture_since` to the global config schema. The scheduler install path records this timestamp once, while the ledger remains repo-local and only records per-transcript capture progress after transcripts are in scope.

That review also tightened the config contract one step further: `automation.capture_since` is user-level only, not project-configurable. `almanac config set --project automation.capture_since ...` and the matching unset path should fail, because a repo-local override would let one wiki silently redefine the user's global historical capture boundary.

`capture sweep --dry-run` is intentionally read-only with respect to ledger state. The sweep still computes eligibility against any existing ledger entries, but it should not create `.almanac/runs/capture-ledger.json` or advance cursors when the user is only previewing work. The first sweep tests lock this behavior in.

## Update timing

The lifecycle is:

1. `almanac capture sweep` discovers a transcript and maps it to a repo.
2. The sweep reads that repo's ledger entry before deciding eligibility.
3. For an append-only transcript with new uncaptured content, the sweep starts a normal capture job using the original full transcript path plus cursor context describing what was already absorbed.
4. When that run is enqueued, the sweep records pending cursor targets and `pendingRunId`.
5. A later sweep reconciles the pending entry against `.almanac/runs/<run-id>.json`.
6. Only after a successful run does the sweep promote the pending cursor into the durable `lastCaptured*` fields.

That two-phase model matters because [[capture-flow]] starts background jobs asynchronously. A sweep can know that work was queued, but it cannot safely claim the new transcript continuation was captured until the run record says it finished successfully.

The same discussion also clarified how scheduled capture is expected to bridge into today's `capture` command. Current `almanac capture` still hands Absorb whole transcript files, not byte ranges or cursor-aware slices. Later turns in the same session replaced the earlier delta-file sketch with a cleaner v1 posture: keep passing the original transcript path, but include cursor instructions such as "already captured through line 812 / byte 184203; focus on later material unless earlier lines are needed for context." That keeps the ledger as the source of truth for what was processed without creating temp sliced transcripts.

The review pass that followed the design discussion tightened this boundary in code. `runCaptureSweepCommand()` now writes the updated pending ledger entry immediately after a capture job is successfully enqueued, rather than waiting until the end of the sweep. That keeps the conceptual two-phase model aligned with the persisted state: once a run id exists, the repo ledger records that pending ownership right away.

## How sweep uses it

The later "show me the ledger example, and how we will be using it" exchange made the operational order explicit:

1. Scan Claude and Codex transcript locations.
2. For each transcript, recover the session cwd or repo hint from the transcript metadata.
3. Walk upward from that cwd to find the nearest `.almanac/`.
4. Ignore transcripts that do not map to a repo with an initialized wiki.
5. For each remaining candidate, read the repo-local ledger entry.
6. Use the ledger to decide whether the transcript is new, already captured through a cursor, already owned by a pending capture, or in a `needs_attention` state that should not advance automatically.
7. Only enqueue capture for newly eligible uncaptured content.

This means transcripts are the discovery surface, `.almanac/` determines whether CodeAlmanac should care, and the ledger determines whether there is any new material worth absorbing.

## Status model

The implemented ledger states are:

- `done`: the last successful cursor is authoritative; fresh entries also start here at the zero cursor
- `pending`: the sweep already enqueued a background capture and reserved `pendingTo*` cursor bounds for it
- `failed`: the last attempted continuation did not finish successfully and is retryable from the last successful cursor
- `needs_attention`: the transcript no longer matches the stored prefix cursor, so automatic continuation is unsafe until a human or future repair path decides what to do

This distinction matters because `queued` and `running` are run-record states under [[process-manager-runs]], not ledger states. The ledger collapses all in-flight ownership into `pending`, then learns whether that pending run finished by reconciling against the background run record on a later sweep.

The preferred v1 posture was to keep pending bounds separate until success is confirmed. The simpler alternative, advancing the cursor as soon as a job is queued, was rejected as too likely to lose retryability after failures.

## Reconciliation

At the start of every sweep, any ledger entry whose status is `pending` should be reconciled against its run record under [[process-manager-runs]]:

1. Read `.almanac/runs/<run-id>.json`.
2. If the run record is still `queued` or `running`, keep the ledger entry `pending` and skip enqueuing another capture for that transcript.
3. If the run is `done`, promote `pendingToSize`, `pendingToLine`, and related pending metadata into the durable `lastCaptured*` fields.
4. If the run is `failed`, `cancelled`, or `stale`, preserve the last successful cursor and mark the transcript retryable.

This is the most important invariant on the page: CodeAlmanac should not claim "captured through byte X / line Y" until the run that absorbed that transcript prefix finished successfully.

## Relationship to hooks

Earlier discussion treated app lifecycle hooks as a likely optional fast path beside scheduled sweep, but the implemented v1 stance is scheduler-only automatic capture. Hook-based auto-capture was removed from onboarding and the public command surface.

That makes the ledger the state model for scheduled sweep, not a neutral compromise between two equally first-class automation systems.

The durable recommendation from the later session state is:

- let the ledger be the repo-local source of truth for capture progress
- let `capture sweep` remain the authoritative owner of cursor semantics
- keep automatic capture scheduler-only so no hook path bypasses the ledger

Future edits should preserve one subtle distinction here: "scheduler-only" removed hook bypasses at the product level, but duplicate prevention still depends on both the ledger and repo-local sweep locking. The current implementation uses `.almanac/runs/capture-sweep.lock` plus early pending-entry writes so overlapping sweeps skip busy repos instead of racing to enqueue the same continuation twice.
