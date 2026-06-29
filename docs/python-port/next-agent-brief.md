# Next Agent Brief

Updated: 2026-06-29

## Current State

- Goal remains active: rebuild CodeAlmanac from scratch as a Python codebase.
- Branch: `dev`.
- Latest implementation slice:
  slice 60 serve browser proof.
- Latest committed product-direction slice: `docs: record viewer design correction`.
- Live contract: `docs/python-port-live-agreement.md`.
- Public release gate: `docs/python-port/public-release-readiness.md`.
- Cosmic Python local guide: `docs/reference/cosmic-python/CODEALMANAC.md`.
- Latest verified source-runtime direction: selected local material becomes
  `SourceAddress -> SourceRef -> SourceBrief -> SourceRuntime` before Ingest
  calls a harness.
- Current Python product surface includes CLI/app composition, workspace
  registry, configurable Almanac root, SQLite read model, search/show/topics/health,
  tag/untag/topic mutation, reindex, doctor, serve, runs/jobs, ingest, garden,
  foreground sync, sync status, local automation, Codex/Claude harness adapters,
  transcript discovery, source runtime adapters, bundled manual resources
  materialized into `<almanac-root>/manual/`, and a conservative package update
  command.
- `codealmanac update` is dogfooded from non-editable pip and uv-tool installs.
  Successful package-manager execution reports status `completed`, not
  `updated`, because package-manager output may say no files changed and the
  service does not scrape prose for stronger semantics.
- Slice 41 implements the configured-root decision: new repos default to
  `almanac/`; users may configure `docs/almanac/` or explicit `.almanac/`.
  The registry stores `almanac_root`, `Workspace` exposes `almanac_path`,
  project config lives under `<almanac-root>/config.toml`, run logs and sync
  ledgers live under `<almanac-root>/jobs/`, and prompts/manual text refers to
  the configured Almanac root.
- Slice 42 completes the configured-root source-runtime follow-through:
  Ingest passes `workspace.almanac_root` through `SourceRuntimeContext`, and
  filesystem directory runtime applies that context for both Git listing and
  Python/pathspec walking. The adapter no longer hard-codes Almanac root names.
- The local viewer now exposes `/api/file?path=...` and frontend
  `#/file/<path>` for wiki file/folder reference navigation. It lists pages
  mentioning the reference and does not read repo source contents.
- Viewer Markdown rendering uses `markdown-it-py` token streams. Wikilink
  rewriting touches inline text tokens only; inline code and fenced code remain
  source text, and link labels are escaped by the renderer.
- `serve` now borrows UseAlmanac's alpine dashboard visual language but keeps
  CodeAlmanac's local wiki IA. Preserve the sidebar/page graph/search/topic/file
  navigation model; do not copy UseAlmanac's hosted wiki page-list/search flow,
  hosted account routes, billing/settings surfaces, or hosted wording. The
  current UseAlmanac wiki page/search UX is a non-target reference. The desired
  shape is the earlier CodeAlmanac sidebar-first local viewer with better visual
  treatment layered over it.
- Slice 51 is a narrow `serve` shell polish pass:
  repo-owned wiki rail wording, `Local knowledge graph` scope text, active
  page/topic rail links from hash-route metadata, mobile rail density cleanup,
  and a CSS guard against viewport-scaled type. Browser-harness visual dogfood
  passed through an isolated temporary Chrome profile with explicit `BU_CDP_URL`;
  default-profile Chrome still requires the manual remote-debugging Allow click.
- Bulletproof React Markdown reference lives under
  `docs/reference/bulletproof-react/`. Treat it as frontend architecture
  guidance for future viewer growth, not a reason to add React/Next.js while
  the static package-data viewer remains maintainable.
- The served frontend now uses static ES modules. `app.js` imports
  `/assets/viewer/main.js`; nested modules split API calls, routes, shared DOM
  components, and screen renderers. The server validates nested static asset
  paths before serving them.
- Source runtime covers filesystem paths, Git, GitHub, transcripts, and web
  URLs behind `services/sources/ports.py::SourceRuntimeAdapter`.
  `InspectSourceRuntimeRequest.context` carries workflow-owned runtime policy
  such as ignored workspace directories.
- `codealmanac.database` owns SQLite connection setup and migration
  application. `IndexStore` owns the first typed store migration for the
  derived `index.db` read model. `services/index/views.py` owns read-only
  query SQL and row-to-Pydantic view construction for search, page/topic reads,
  and health.
- `services/config` owns local TOML config parsing and precedence. Project
  config is `<almanac-root>/config.toml`; CLI flags still win over config. It
  uses `pydantic-settings` TOML sources.
  The first supported fields are `[harness].default` and `[sync].quiet`.
- Slice 40 splits the CLI edge: `main.py` is thin, parser construction is under
  `cli/parser/` by command domain, and dispatch/render moved to
  `cli/dispatch/root.py` and `cli/render/root.py`.
- Slice 49 splits the admin CLI edge. `doctor`, `update`, `jobs`, and
  `automation` live under `cli/dispatch/admin.py` and `cli/render/admin.py`;
  shared CLI config/duration resolution lives in `cli/dispatch/config.py`.
  Wiki/lifecycle dispatch remains in root until a concrete command change
  creates pressure.
- Filesystem directory runtime uses Git listing inside worktrees, then falls
  back to the bounded Python/pathspec walk outside Git.
- Directory runtime ranks changed and untracked files before unchanged files,
  interleaves clean directory groups, prefers role-bearing files, and labels
  included files as `changed` or `unchanged`.
- Public-contract tests guard the local-only CLI/package surface: only the
  `codealmanac` script, no hosted verbs, no compatibility aliases, and no
  `sdk` or `mcp` package modules. They also guard README/package metadata so
  old Node/npm, `almanac`, hosted-dashboard, and `absorb` language does not
  return.
- `README.md` now documents the Python local product surface: Python 3.12+,
  `codealmanac`, default `almanac/`, local install, local read commands,
  lifecycle commands, sync, automation, jobs, providers, configuration, and the
  no-hosted/no-alias public contract.
- Slice 57 real Codex ingest dogfood passed through `IngestWorkflow` and
  `CodexCliHarnessAdapter` in isolated temp repos. The first run exposed broken
  page links from over-eager entity wikilinking; prompt/manual guidance now
  says page links must resolve. A second real Codex run on the same source
  shape produced a page with no broken links. Starter scaffold topics were
  narrowed so fresh init no longer creates empty-topic health noise.
- Slice 58 real Claude ingest dogfood passed through `IngestWorkflow` and
  `ClaudeCliHarnessAdapter` in an isolated temp repo. It created
  `incident-window-policy.md`, updated `topics.yaml`, preserved mutation safety,
  produced readable `jobs logs`, and left `health --json` clean. Public CLI
  readback worked for jobs logs, search, show, and health. No code or prompt
  patch was needed.
- Slice 59 real sync dogfood passed against a temp Codex transcript and real
  Claude-backed Ingest. Sync discovered one ready transcript, started
  `ingest-20260629231810-40e74df3`, advanced the ledger to `done`, skipped the
  same transcript as `unchanged` on the second status run, produced
  `sync-workflow.md`, and left health clean. Public CLI readback worked for
  `sync status`, `jobs logs`, `jobs show`, `search`, `show`, and
  `health --json` when selected with `uv run --project` because the branch is
  not published yet.
- Slice 60 serve browser proof passed through browser-harness against a live
  temp `serve` instance. The desktop routes `/`, `#/page/auth-flow`,
  `#/topic/auth`, `#/search/auth`, and `#/file/src/auth/session.py` rendered the
  expected headings/content with no horizontal overflow. A 390px mobile
  `#/page/auth-flow` route also rendered page content and file refs with no
  horizontal overflow. No viewer code or CSS patch was needed.
- The manual surface is a support package, not a public command. `ManualLibrary`
  reads `src/codealmanac/manual/*.md`, `build`/`init` copy missing docs into
  the configured root's `manual/`, prompts tell lifecycle agents to read those
  docs, and `doctor` checks package/workspace manual readiness. Slice 52 adds
  drift diagnostics: complete manual files that differ from bundled docs are
  reported as informational review work, not overwritten by build/init.
- `codealmanac list` is the local registry management surface. Plain `list`
  keeps the three-column output; `list --json` reports registry availability;
  `list --drop <selector>` removes one explicit entry; `list --drop-missing`
  explicitly removes unreachable entries. Read commands do not prune registry
  state silently.
- Lifecycle workflows record normalized harness events before later validation.
  `ingest` and `garden` write returned `HarnessEvent` values as soon as the
  harness returns, so failed harness runs remain visible in `jobs logs` even
  when the terminal run error is a mutation-safety failure. Current Codex and
  Claude CLI adapters emit terminal `done` events only; Codex app-server is
  the future path if jobs need richer text/tool/usage transcript completeness.
- Foreground `sync` writes a durable pending ledger claim before invoking
  Ingest, skips active pending transcript ranges, reports stale pending ranges
  as needs-attention, stores linked run ids plus cursor snapshots, reconciles
  terminal linked runs before cursor evaluation, and clears pending fields on
  terminal success/failure.
- Scheduled sync is still foreground `sync` launched by automation. Automation
  passes a stable claim owner, pending timeout, and failed-attempt budget.
  `SyncLedgerEntry.failed_attempts` stops repeated failures at
  `sync-retry-budget-exhausted`.
- Run records now have an explicit lifecycle transition: queued at creation,
  running before Ingest/Garden side effects, then terminal done/failed/cancelled.
- Ingest remains source-kind agnostic. It resolves `SourceBrief` values, asks
  `SourcesService.inspect_runtime(...)` for snapshots, renders typed runtime
  JSON into the prompt, calls the selected harness, validates wiki-root
  mutation safety, refreshes the index, and records the run. Normalized
  harness events are recorded before safety/success validation.
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

Slice 48 dogfooded non-editable update installs.

Behavior:

- pip-installed wheel metadata reports `installer: pip`
- pip update plans the throwaway venv Python command
- uv-tool-installed wheel metadata reports `installer: uv`
- uv-tool update plans `uv tool upgrade codealmanac`
- successful foreground package-manager execution returns status `completed`
  instead of over-claiming installed files changed
- scheduled update automation remains deferred until notifier cadence,
  dismissal behavior, and release-channel policy are agreed

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
  `<almanac-root>/manual/` without overwriting local edits
- `codealmanac doctor` reports `install.manual` and `wiki.manual`
- lifecycle prompts point agents at the configured root's `manual/` before wiki
  edits

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

Slice 36 adds run lifecycle state.

Behavior:

- `RunsService.mark_running(...)` moves a queued run to running
- `RunStore` sets `started_at` and appends a `running` status event
- marking an already running run is idempotent
- marking a terminal run running raises a conflict
- Ingest and Garden mark their run records running before side-effecting work
- this prepares sync reconciliation but does not add a background queue or
  pending run id yet

Slice 37 adds sync pending run linkage.

Behavior:

- `IngestWorkflow.run(...)` keeps its public contract but now delegates to
  `start(...)` and `run_with_run(...)`
- foreground `sync` creates the Ingest run before claiming the transcript range
- pending sync ledger entries store `pending_run_id`, `pending_to_size`,
  `pending_prefix_hash`, and claimed line range
- `sync status` reports linked active runs as `sync-pending-run-active`
- `sync status` reports linked terminal done runs as `sync-pending-run-done`
- foreground `sync` promotes linked done pending cursors before checking for
  newer transcript bytes
- foreground `sync` clears failed/cancelled linked pending claims and retries
  from the last successful cursor when the transcript prefix still matches
- unlinked pending entries keep the existing active/stale timeout behavior

Slice 46 ports the serve visual system.

Behavior:

- local viewer uses UseAlmanac-inspired dashboard shell, left rail, account
  picker styling, search header, page list rows, wiki page surface, and side
  panel styling
- product IA stays local: overview, page, topic, search, and file-reference
  routes over repo-owned wiki pages
- no hosted account, billing, settings, or UseAlmanac hosted wiki routes
- do not copy the current UseAlmanac wiki page/search UX; preserve the
  sidebar-first local reader shape and improve the design layer around it
- browser-harness verified desktop page/search/file/wikilink navigation and
  mobile no-overflow behavior

Slice 47 modularizes the serve frontend.

Behavior:

- `app.js` is a tiny ES module entrypoint
- `server/assets/viewer/api.js` owns viewer HTTP calls
- `server/assets/viewer/routes.js` owns hash parsing and href builders
- `server/assets/viewer/components.js` owns shared DOM pieces
- `server/assets/viewer/renderers.js` owns page/search/topic/file screens
- `server/assets/viewer/main.js` wires browser events and state
- `/assets/{path}` validates and serves nested package assets
- React/Next.js remains deferred until real viewer complexity requires it

Slice 38 adds the database boundary.

Behavior:

- `src/codealmanac/database/` now exposes `connect_sqlite(...)`,
  `apply_migrations(...)`, and `SQLiteMigration`
- SQLite parent directory creation, row factory setup, `foreign_keys`, and
  `journal_mode=WAL` live in `database/`
- `services/index/store.py` supplies a typed rebuild migration for `index.db`
- `IndexStore` still owns the schema DDL, refresh/rebuild behavior, search SQL,
  topic SQL, health SQL, and row conversion
- `tests/test_architecture.py` rejects direct `sqlite3` imports outside the
  database package

Slice 39 adds the config boundary.

Behavior:

- `src/codealmanac/services/config/` now exposes Pydantic config models,
  `LoadConfigRequest`, `ConfigStore`, and `ConfigService`
- `ConfigStore` reads TOML through `pydantic-settings`
  `TomlConfigSettingsSource`
- `ConfigService` merges defaults, user config, and selected-project config
- `ingest`, `garden`, `sync`, `sync status`, and `automation install` resolve
  lifecycle defaults through `app.config`
- `tests/test_architecture.py` rejects `tomllib` imports outside
  `services/config`

Slice 40 splits the CLI edge.

Behavior:

- `src/codealmanac/cli/main.py` owns parser invocation, app construction,
  dispatch, and known error formatting only
- parser construction lives under `cli/parser/` by command domain
- dispatch and render live under `cli/dispatch/root.py` and
  `cli/render/root.py`
- architecture tests keep `main.py` and parser root thin

Slice 41 adds configurable Almanac roots.

Behavior:

- first-time `codealmanac init` and `codealmanac build` default to
  `--root almanac`
- existing registered repos keep their registered root when `--root` is omitted
- setup can explicitly use `--root docs/almanac` or `--root .almanac`
- `WorkspaceRegistryEntry` stores `almanac_root`
- `WorkspacesService.resolve(...)` discovers default roots plus roots already
  present in the registry
- `codealmanac list` prints name, repo path, and configured root
- `WikiService`, index, runs, sync ledger, config, prompts, and manual surfaces
  resolve through `workspace.almanac_path`
- transcript candidates now carry `almanac_path`
- index health receives the true repo root rather than assuming
  `almanac_path.parent`

Slice 42 adds source runtime context.

Behavior:

- `SourceRuntimeContext` carries repo-relative ignored directories into source
  runtime inspection
- Ingest sets that context from `workspace.almanac_root`
- filesystem directory runtime applies the ignored directories in both Git and
  non-Git traversal
- filesystem runtime no longer treats `almanac/`, `docs/almanac/`, or
  `.almanac/` as universal ignore names

Slice 43 adds scheduled sync retry policy.

Behavior:

- automation installs scheduled sync with `--claim-owner
  codealmanac.automation.sync`, `--pending-timeout 24h`, and
  `--max-failed-attempts 3`
- sync ledger entries record `failed_attempts`
- failed Ingest attempts increment the counter
- successful absorb resets the counter
- exhausted failed entries report `sync-retry-budget-exhausted` instead of
  retrying forever

Slice 44 adds clean directory diversity.

Behavior:

- filesystem runtime selection is a pure adapter-local ranking core after
  Git/walk I/O has produced candidates
- changed and untracked files still rank before unchanged files
- unchanged file selection interleaves directory groups before taking a second
  file from the same group
- role-bearing files such as `service.py`, `adapter.py`, `app.py`, and
  `main.py` rank ahead of generic source files inside a group
- Git directory metadata now reports `selection_policy: changed_then_diverse`

Slice 45 locks viewer wikilink token safety.

Behavior:

- `MarkdownRenderer` parses CommonMark with `markdown-it-py`
- wikilink rewriting only rewrites inline child tokens with type `text`
- inline code and fenced code containing `[[...]]` remain code text
- wikilink labels render through text tokens, so HTML in labels is escaped
- server and viewer service layers do not perform raw HTML string rewrites

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
- Slice 36 run lifecycle tests, full pytest, full ruff, diff check, and live
  run-status dogfood
- Slice 37 sync pending run-linkage tests, ingest regression tests, full
  pytest, full ruff, diff check, and live sync reconciliation dogfood
- Slice 38 database helper tests, read-model regression tests, architecture
  boundary test, full pytest, full ruff, diff check, and live build/search
  dogfood
- Slice 39 config service tests, CLI default-resolution tests, architecture
  boundary test, full pytest, full ruff, diff check, and live config dogfood
- Slice 40 focused CLI/public-contract/architecture tests, full pytest, full
  ruff, diff check, package build, CLI help smoke, and temp build/search
  dogfood
- Slice 41 focused root/config/sync/lifecycle/CLI tests, full pytest, full
  ruff, diff check, package build, and temp build/search dogfood with default
  `almanac/`
- Slice 42 focused filesystem/source/ingest tests, full pytest, full ruff,
  diff check, package build, and custom-root source-runtime dogfood
- Slice 43 focused sync/automation/CLI tests, full pytest, full ruff, diff
  check, package build, and retry-budget dogfood
- Slice 44 focused filesystem selection/runtime tests, full pytest, full ruff,
  diff check, package build, and source-runtime dogfood against
  `src/codealmanac/`
- Slice 45 focused viewer renderer/service/server tests, full pytest, full
  ruff, diff check, package build, and renderer dogfood snippet
- Slice 46 focused viewer/server tests, focused ruff, browser-harness desktop
  page/search/file/wikilink navigation, and browser-harness mobile no-overflow
  checks
- Slice 47 focused server/viewer tests, focused server ruff, nested asset route
  tests, and package-data preparation for wheel inspection
- Slice-47 review fix focused server/viewer tests, focused server ruff, diff
  check, and browser-harness malformed-hash dogfood
- Slice 49 focused architecture/admin CLI tests, focused CLI ruff, full pytest,
  full ruff, diff check, package build, wheel inspection, and live admin CLI
  dogfood for update, doctor, automation, jobs, and help
- Slice 50 focused read-view tests, focused index lint, temp-repo CLI read
  dogfood, full pytest, full ruff, diff check, package build, and wheel
  inspection
- Slice 51 focused serve/static tests, full pytest, full ruff, diff check,
  package build, static/API serve dogfood, and browser-harness desktop/mobile
  verification through an isolated Chrome profile
- Slice 52 focused manual/diagnostics/CLI tests, focused ruff, full pytest,
  full ruff, diff check, package build, and manual-drift doctor dogfood
- Slice 53 focused workspace/CLI tests, focused ruff, source-runtime dogfood
  against this repo, full pytest, full ruff, diff check, package build, and
  list JSON/drop/drop-missing dogfood
- Slice 54 focused ingest/garden workflow tests, focused lifecycle ruff,
  full pytest, full ruff, diff check, package build, and harness-failure-log
  dogfood
- Slice 55 focused harness/adapter/workflow tests, focused ruff, full pytest,
  full ruff, diff check, package build, and normalized-harness-event jobs-log
  dogfood
- Slice 56 focused public-contract tests, focused ruff, full pytest, full ruff,
  diff check, package build, wheel metadata inspection, and clean wheel install
  CLI dogfood
- Slice 57 focused prompt/manual/build tests, two real Codex ingest dogfood
  runs, and health checks showing the prompt fix removed broken page links
- Slice 58 real Claude ingest dogfood, public CLI readback for jobs/search/show
  /health, and Relayforge Discord note through Doppler `almanac/dev`
- Slice 59 real sync dogfood, repeat unchanged-skip proof, clean health, and
  public CLI readback for sync/jobs/search/show/health
- Slice 60 browser-harness proof for live `serve` desktop overview/page/topic
  /search/file routes and mobile page route

## Next Move

1. Likely next pressure points:
   - final wheel/sdist package rehearsal from non-editable installs before any
     publish attempt
   - more lifecycle dogfood for prompt quality and real project behavior; add
     source-runtime ranking/recency only after a failing case proves current
     diversity is insufficient
   - scheduled update automation only after non-editable update dogfood
   - serve polish after product review; slice 51 browser-verified the sidebar
     shell through an isolated temporary Chrome profile, while default-profile
     Chrome remote debugging still needs the manual Allow click
   - manual replacement policy only if users need a workflow for accepting
     bundled doctrine changes; doctor now reports drift, while build/init still
     copy missing files only
   - index refresh cost only after large-repo dogfood proves source-signature
     parsing is too slow; slice 50 split read views but did not optimize refresh
   - richer registry filtering only if local wiki management needs more than
     explicit JSON/drop/drop-missing
2. Do not add hosted CLI, login/connect/upload, MCP, SDK, public `capture`,
   public `absorb`, or public `almanac`/`alm` aliases.
3. Keep future source material additions inside `SourceAddress -> SourceRef ->
   SourceBrief -> SourceRuntime` unless the live agreement changes.
4. Browser-harness note from 2026-06-29: Chrome remote debugging is available
   in this workspace. Slice 46 verified `serve` with browser-harness on
   desktop and mobile. Keep using browser-harness for future visual changes.
