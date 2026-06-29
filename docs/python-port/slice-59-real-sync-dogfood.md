# Slice 59 - Real Sync Dogfood

Date: 2026-06-29

## Purpose

Prove foreground sync against realistic local transcript material before public
release.

## Scope

- Discover a transcript-shaped Codex JSONL file from a temp home.
- Keep the workspace registry isolated from the user's real registry.
- Run sync through the Python service boundary.
- Let sync invoke real Ingest with the real Claude CLI harness.
- Prove the second run skips the same transcript as unchanged.
- Verify health and public CLI readback from the temp repo.

## Dogfood Shape

The dogfood used:

- temp root:
  `/var/folders/v2/f289rp_d0_118wk72xtvtp5r0000gn/T/codealmanac-real-sync-dogfood-iy43auuy`
- temp repo:
  `/var/folders/v2/f289rp_d0_118wk72xtvtp5r0000gn/T/codealmanac-real-sync-dogfood-iy43auuy/repo`
- temp home:
  `/var/folders/v2/f289rp_d0_118wk72xtvtp5r0000gn/T/codealmanac-real-sync-dogfood-iy43auuy/home`
- transcript:
  `home/.codex/sessions/2026/06/29/sync-dogfood.jsonl`

The transcript used the Codex metadata shape:

```json
{"type":"session_meta","payload":{"id":"sync-dogfood-codex-session","cwd":"<repo>","thread_source":"user"}}
```

The source material stated two durable facts:

- Sync owns discovery, quiet-window selection, claiming, and cursor
  advancement.
- Ingest owns wiki prose after sync passes `transcript:<path>` as source
  material.

The call stayed at the workflow boundary:

```python
app.workflows.sync.run(
    RunSyncRequest(
        cwd=repo,
        apps=(TranscriptApp.CODEX,),
        quiet=timedelta(seconds=0),
        home=temp_home,
        harness=HarnessKind.CLAUDE,
        claim_owner="real-sync-dogfood",
    )
)
```

This matches the Cosmic Python external-event lesson: the transcript is an
outside message stream, discovery normalizes it into a typed candidate, sync
evaluates cursor state, and the application use case calls Ingest rather than
writing pages itself.

## Evidence

Initial status found one ready transcript:

```text
STATUS_BEFORE scanned=1 eligible=1 ready codex sync-dogfood-codex-session lines 1-3
```

Sync completed with:

- run id `ingest-20260629231810-40e74df3`
- started app `codex`
- session id `sync-dogfood-codex-session`
- range `from_line=1`, `to_line=3`
- created page `almanac/pages/sync-workflow.md`
- ledger status `done`
- `last_absorbed_size=962`
- `last_absorbed_line=3`
- `last_job_id=ingest-20260629231810-40e74df3`

Second status skipped the transcript:

```text
STATUS_AFTER scanned=1 eligible=0 skipped reason=unchanged
```

Health was clean:

```json
{
  "orphans": [],
  "dead_refs": [],
  "broken_links": [],
  "broken_xwiki": [],
  "empty_topics": [],
  "empty_pages": []
}
```

The temp repo had exactly one wiki content change:

```text
?? almanac/pages/sync-workflow.md
```

## Public CLI Readback

Because this branch is not published yet, CLI readback used:

```text
uv run --project /Users/rohan/Desktop/Projects/codealmanac codealmanac ...
```

The public command surface passed:

```text
codealmanac sync status --from codex --quiet 0s
codealmanac jobs logs ingest-20260629231810-40e74df3
codealmanac jobs show ingest-20260629231810-40e74df3 --json
codealmanac search sync
codealmanac show sync-workflow --lead
codealmanac health --json
```

`jobs logs` showed:

```text
1 status queued ingest
2 status running
3 message verified clean almanac preflight
4 message resolved 1 source
5 message loaded 1 source runtime snapshot
6 output claude succeeded: Created `sync-workflow.md`.
7 status done
```

## Result

No code or prompt patch was needed. The sync release gate now has real evidence:
discovery, readiness, pending claim, Ingest handoff, ledger advancement, repeat
skip, health, and CLI inspection all worked in an isolated local repo.

The remaining public-release gates are viewer browser proof after the latest
changes and final package rehearsal from non-editable installs.
