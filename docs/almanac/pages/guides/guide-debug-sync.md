---
page_id: guide-debug-sync
title: Debug Sync
summary: Use this guide when `sync` does not ingest the transcript you expected or reports skipped and needs-attention entries.
topics: [guides, lifecycle]
sources:
  - id: sync-service
    type: file
    path: src/codealmanac/workflows/sync/service.py
  - id: sync-evaluation
    type: file
    path: src/codealmanac/workflows/sync/evaluation.py
  - id: sync-decisions
    type: file
    path: src/codealmanac/workflows/sync/decisions.py
---

# Debug Sync

Use this guide when sync scans transcripts but does not start the ingest you expected. The likely cause is candidate scope, quiet-window policy, internal transcript filtering, pending ledger state, cursor evaluation, or failed transcript reading. [@sync-service] [@sync-evaluation] [@sync-decisions]

## Preconditions

Know which app transcript you expect sync to find, such as Codex or Claude.

## Steps

1. Run `codealmanac sync status --from <app>` to see scanned, ready, skipped, and needs-attention entries.
2. Check whether the transcript is still inside the quiet window.
3. Check whether the transcript belongs to the selected workspace.
4. Check whether a pending linked run already owns the transcript range.
5. If a linked run is terminal, run foreground sync once so reconciliation can update the ledger.
6. If needs-attention reports read failure or stale pending state, inspect the transcript path and `[[reference-sync-ledger]]`.

## Verification

Run `codealmanac sync status` again. A ready item should appear before foreground ingest, or a started run should appear after `codealmanac sync`.

## Recovery

If the ledger state is wrong, first inspect linked run records with `codealmanac jobs show <run-id>`. Do not delete ledger files until the linked run state is understood.

