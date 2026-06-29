# Slice 32 - Filesystem Directory Selection

Date: 2026-06-29

## Intent

Make broad directory sources more useful without changing the source product
model. A directory remains one selected source ref. The filesystem runtime
chooses better prompt material inside the adapter.

## Problem

Slice 31 made directory listing Git-aware, but it still took the first bounded
files after sorting. Dogfood against this repo's dirty `src/codealmanac/`
directory selected unchanged package and CLI files before the files edited in
the current slice, then hit the file-count bound.

## Design

- Keep `SourceAddress -> SourceRef -> SourceBrief -> SourceRuntime` unchanged.
- Add `integrations/sources/filesystem/selection.py` as an adapter-internal
  selection policy.
- Use Git status only when Git listing already succeeded.
- Parse `git status --porcelain=v1 -z --untracked-files=all -- <path>` for a
  stable machine-readable changed-file signal.
- Rank changed and untracked files before unchanged files.
- Rank unchanged files deterministically by content kind, path depth, and path.
- Annotate the rendered tree with `changed` or `unchanged`.

## Out Of Scope

- No durable source-pool, candidate, or add/capture object.
- No hosted sync/upload behavior.
- No semantic ranking or vector search.
- No service/workflow branching on directory shape.

## Cosmic Python Transfer

Chapter 5 recommends high-gear tests against the service layer when behavior
should survive refactoring. This slice keeps tests driving
`app.sources.resolve(...)` and `app.sources.inspect_runtime(...)` instead of
private selector helpers. The new selector is still typed because it is a named
adapter concept, but the public behavior is verified through the service port.

Chapter 13 keeps the subprocess seam explicit: the filesystem adapter continues
to receive a `CommandRunner`, and Git mechanics stay outside services and
workflows.

## Verification

- `uv run pytest tests/test_filesystem_source_runtime.py`
- `uv run pytest tests/test_sources_service.py tests/test_ingest_workflow.py tests/test_architecture.py`
- `uv run ruff check src/codealmanac/integrations/sources/filesystem tests/test_filesystem_source_runtime.py`
- Dogfood: inspect `src/codealmanac/` in this dirty checkout and confirm the
  changed filesystem adapter and selector files appear before unchanged files.

## Follow-Up

Clean large directories may still need semantic diversity or recency ranking.
Add that only after dogfood shows which unchanged files are wrong.
