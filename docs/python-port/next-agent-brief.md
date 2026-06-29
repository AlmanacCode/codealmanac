# Next Agent Brief

Updated: 2026-06-29

## Current State

- Goal remains active: rebuild CodeAlmanac from scratch as a Python codebase.
- Branch: `codex/python-port-archive-existing-code`.
- Latest committed slice: `feat(slice-35): add sync pending claims`.
- Live contract: `docs/python-port-live-agreement.md`.
- Cosmic Python local guide: `docs/reference/cosmic-python/CODEALMANAC.md`.
- Latest verified source-runtime direction: selected local material becomes
  `SourceAddress -> SourceRef -> SourceBrief -> SourceRuntime` before Ingest
  calls a harness.
- Current Python product surface includes CLI/app composition, workspace
  registry, `.almanac/` build, SQLite read model, search/show/topics/health,
  tag/untag/topic mutation, reindex, doctor, serve, runs/jobs, ingest, garden,
  foreground sync, sync status, local automation, Codex/Claude harness adapters,
  transcript discovery, source runtime adapters, bundled manual resources
  materialized into `.almanac/manual/`, and a conservative package update
  command.
- The local viewer now exposes `/api/file?path=...` and frontend
  `#/file/<path>` for wiki file/folder reference navigation. It lists pages
  mentioning the reference and does not read repo source contents.
- Source runtime covers filesystem paths, Git, GitHub, transcripts, and web
  URLs behind `services/sources/ports.py::SourceRuntimeAdapter`.
- Filesystem directory runtime uses Git listing inside worktrees, then falls
  back to the bounded Python/pathspec walk outside Git.
- Git-listed directory runtime ranks changed and untracked files before
  unchanged files and labels included files as `changed` or `unchanged`.
- Public-contract tests guard the local-only CLI/package surface: only the
  `codealmanac` script, no hosted verbs, no compatibility aliases, and no
  `sdk` or `mcp` package modules.
- The manual surface is a support package, not a public command. `ManualLibrary`
  reads `src/codealmanac/manual/*.md`, `build`/`init` copy missing docs into
  `.almanac/manual/`, prompts tell lifecycle agents to read those docs, and
  `doctor` checks package/workspace manual readiness.
- Foreground `sync` writes a durable pending ledger claim before invoking
  Ingest, skips active pending transcript ranges, reports stale pending ranges
  as needs-attention, and clears pending fields on terminal success/failure.
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

Slice 31 added Git-backed filesystem directory listing.

Behavior:

- directory runtime runs `git ls-files -z --cached --others --exclude-standard`
  when the selected directory is inside a Git worktree
- nested `.gitignore`, `.git/info/exclude`, and global Git excludes are handled
  by Git rather than copied into Python
- CodeAlmanac still filters private/generated defaults such as `.almanac/`,
  `.env`, and `.gitignore`
- non-Git directories keep the old bounded Python/pathspec walk
- runtime metadata includes `listing_source: git` or `listing_source: walk`

Slice 32 adds changed-first directory selection.

Behavior:

- Git-listed directory runtime also asks `git status --porcelain=v1 -z` for the
  selected path
- changed and untracked files are ranked before unchanged files
- unchanged files keep deterministic content/path ordering
- runtime metadata includes `selection_policy: changed_first`
- the rendered tree annotates included files as `changed` or `unchanged`

Slice 33 adds public contract guards.

Behavior:

- `tests/test_public_contract.py` asserts the only project script is
  `codealmanac`
- parser tests reject hosted or alias commands such as `login`, `connect`,
  `upload`, `capture`, `absorb`, `use`, `sources`, `mcp`, and `sdk`
- package tree tests reject `sdk` and `mcp` Python modules

Slice 34 adds the local manual surface.

Behavior:

- `src/codealmanac/manual/` packages the wiki-maintenance rulebook
- `ManualLibrary` reads bundled docs, installs missing workspace manual files,
  and reports workspace completeness
- `app.py` wires `ManualLibrary` once and injects it into `WikiService` and
  `DiagnosticsService`
- `codealmanac init` and `codealmanac build` copy missing files into
  `.almanac/manual/` without overwriting local edits
- `codealmanac doctor` reports `install.manual` and `wiki.manual`
- lifecycle prompts point agents at `.almanac/manual/` before wiki edits

Slice 35 adds sync pending claims.

Behavior:

- foreground `sync` writes a `PENDING` sync ledger entry before invoking Ingest
- pending entries record owner, start time, and claimed line range
- ledger keys use normalized transcript paths, and lookup can match stored
  entries by normalized app/session/transcript identity
- active pending entries are skipped by status/run
- stale pending entries surface as needs-attention instead of being skipped
  forever
- terminal success/failure clears pending fields
- this is not a full background retry/reconciliation loop

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
- Slice 31 focused filesystem/source/ingest/architecture tests and focused ruff
- Slice 32 focused filesystem tests, source/ingest/architecture tests, focused
  ruff, and dirty-checkout dogfood against `src/codealmanac/`
- Slice 33 public-contract tests, focused CLI/architecture tests, full pytest,
  full ruff, diff check, package build, and live CLI help smoke
- Slice 34 manual/build/doctor/prompt tests, full pytest, full ruff, diff
  check, package build with manual Markdown wheel inspection, and isolated
  build/doctor manual dogfood
- Slice 35 sync pending tests, full pytest, full ruff, diff check, and pending
  claim dogfood

## Next Move

1. Likely next pressure points:
   - semantic diversity or recency ranking for clean large directories if
     Git-listed unchanged files are still too noisy in dogfood
   - background sync retry/reconciliation now that durable pending claims exist
   - scheduled update automation only after non-editable update dogfood
   - browser-harness visual verification for `serve` once Chrome remote
     debugging permission is available
   - manual update/sync policy only if bundled doctrine must update existing
     workspace manual files; ordinary build/init currently copies missing files
     only
2. Do not add hosted CLI, login/connect/upload, MCP, SDK, public `capture`,
   public `absorb`, or public `almanac`/`alm` aliases.
3. Keep future source material additions inside `SourceAddress -> SourceRef ->
   SourceBrief -> SourceRuntime` unless the live agreement changes.
