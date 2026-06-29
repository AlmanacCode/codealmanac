# Next Agent Brief

Updated: 2026-06-29

## Current State

- Goal remains active: rebuild CodeAlmanac from scratch as a Python codebase.
- Branch: `codex/python-port-archive-existing-code`.
- Latest committed slice: `feat(slice-30): add viewer file route`.
- Live contract: `docs/python-port-live-agreement.md`.
- Cosmic Python local guide: `docs/reference/cosmic-python/CODEALMANAC.md`.
- Latest verified source-runtime direction: selected local material becomes
  `SourceAddress -> SourceRef -> SourceBrief -> SourceRuntime` before Ingest
  calls a harness.
- Current Python product surface includes CLI/app composition, workspace
  registry, `.almanac/` build, SQLite read model, search/show/topics/health,
  tag/untag/topic mutation, reindex, doctor, serve, runs/jobs, ingest, garden,
  foreground sync, sync status, local automation, Codex/Claude harness adapters,
  transcript discovery, source runtime adapters, and a conservative manual
  update command.
- The local viewer now exposes `/api/file?path=...` and frontend
  `#/file/<path>` for wiki file/folder reference navigation. It lists pages
  mentioning the reference and does not read repo source contents.
- Source runtime covers filesystem paths, Git, GitHub, transcripts, and web
  URLs behind `services/sources/ports.py::SourceRuntimeAdapter`.
- Ingest remains source-kind agnostic. It resolves `SourceBrief` values, asks
  `SourcesService.inspect_runtime(...)` for snapshots, renders typed runtime
  JSON into the prompt, calls the selected harness, validates `.almanac/`
  mutation safety, refreshes the index, and records the run.
- The CLI remains a thin adapter. Do not shell out to `codealmanac` from
  workflows, automation, tests, or future server wrappers.

## Recent Slices

Slice 28 added `FilesystemSourceRuntimeAdapter` under
`integrations/sources/filesystem/`.

Behavior:

- supports `path.file`, `path.directory`, and `path.unknown`
- reads explicit text files with bounded bytes
- decodes file bytes through `charset-normalizer`
- returns unavailable runtime for missing or binary files
- walks directories lazily and stops after a file-count bound
- applies root `.gitignore` patterns through `pathspec`
- skips generated/private traversal paths such as `.git/`, `.almanac/`,
  `node_modules/`, virtualenv/cache directories, `.gitignore`, and `.env`
  files
- renders directory runtime as metadata, a compact tree, and included file
  sections
- makes ordinary `note.md` ingest prompt content available instead of skipped

Runtime dependencies added:

- `pathspec>=1.1.1`
- `charset-normalizer>=3.4.7`

Slice 29 added the manual `codealmanac update` command.

Behavior:

- detects install metadata through `importlib.metadata`
- supports uv tool installs with `uv tool upgrade codealmanac`
- supports pip installs with `python -m pip install --upgrade codealmanac`
- refuses editable/source installs with `run: git pull && uv sync`
- keeps update automation unscheduled until non-editable install dogfood exists

Slice 30 added the viewer file route.

Behavior:

- `ViewerService.file(...)` uses the index mentions query to find pages that
  reference a file or folder
- `/api/file?path=src/foo.py` returns `ViewerFile` payloads
- frontend file refs in the right rail route to `#/file/<path>`
- parent traversal such as `../secret.txt` is rejected before querying
- the route is graph navigation, not source-code preview

## Verification To Preserve

- Focused filesystem/source/ingest/architecture tests
- Focused ruff over source integrations and touched tests
- Full pytest
- Full ruff
- `git diff --check`
- Package build with wheel inspection for filesystem adapter and new metadata
  dependencies
- Dogfood with a temp Git repo, local `notes.md` and `src/` inputs, real
  default filesystem runtime, fake harness, and search readback
- Slice 29 focused update service/CLI/architecture tests
- Slice 29 focused ruff
- Slice 29 live editable-install checks:
  `update --check`, `update --check --json`, and default `update` refusing
  mutation
- Slice 30 focused viewer/server tests, full pytest, full ruff, diff check,
  package build asset inspection, and live `serve` API dogfood for file,
  folder, traversal rejection, and frontend asset wiring

## Next Move

1. Likely next pressure points:
   - large-repo tuning for filesystem directory runtime
   - background sync pending/reconciliation only if a durable owner is added
   - scheduled update automation only after non-editable update dogfood
   - browser-harness visual verification for `serve` once Chrome remote
     debugging permission is available
2. Do not add hosted CLI, login/connect/upload, MCP, SDK, public `capture`,
   public `absorb`, or public `almanac`/`alm` aliases.
3. Keep future source material additions inside `SourceAddress -> SourceRef ->
   SourceBrief -> SourceRuntime` unless the live agreement changes.
