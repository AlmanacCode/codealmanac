# Python Port Worklog

## 2026-07-01

- Active goal continued for architecture quality after public-beta package
  proof: keep applying Cosmic Python, `MANUAL.md`, the live agreement, and
  useful `../almanac` patterns until remaining cleanup is genuinely
  diminishing returns.
- Added slice-73 page-run workflow plan after comparing current
  `ingest`/`garden` duplication with `../almanac`'s page-run workflow shape.
- Extracted `workflows/page_run/` so shared page-writing lifecycle execution
  owns running-state transition, mutation preflight, harness invocation,
  harness transcript/event recording, mutation validation, index refresh,
  terminal success, and failure recording.
- Kept `IngestWorkflow` responsible for source resolution, source runtime, and
  ingest prompt payloads. Kept `GardenWorkflow` responsible for index/health
  context and garden prompt payloads.
- Added architecture tests that prevent `ingest` and `garden` from importing
  shared run/harness plumbing directly, and keep the page-writing workflow
  services small.
- Verified slice 73 with focused ingest, garden, architecture tests and
  focused ruff checks before broad verification.
- Ran an isolated live service dogfood with a fake Codex harness. Ingest
  finished `done`, wrote `page-run-dogfood`, and preserved the expected run
  event sequence: `status,status,message,message,message,output,status`.
- Added slice-74 jobs control plan and implementation. `jobs attach` now
  replays durable log events plus current status; `jobs cancel` marks
  queued/running runs cancelled through `RunsService`; `RunStore.finish(...)`
  returns already-cancelled runs unchanged so later workflow finalization cannot
  resurrect a cancelled job.
- Verified slice 74 focused behavior with runs-service, CLI, and architecture
  tests before broad verification.
- Ran an isolated CLI dogfood for `jobs attach` and `jobs cancel` against a
  temporary repo. Attach replayed the queued job log and current status; cancel
  marked the job `cancelled`; `jobs show` read back the cancelled record.

## 2026-06-29

- Active goal created for a full Python rewrite using
  `docs/python-port-live-agreement.md`, Cosmic Python guidance, slow
  development, frequent review, tests, live CLI checks, and small verified
  commits.
- Current branch is `codex/python-port-archive-existing-code`.
- Existing TypeScript/Node implementation is staged under `archive/code/`.
- Local Cosmic Python reference exists as Markdown-only files under
  `docs/reference/cosmic-python/`.
- Read `MANUAL.md`, `CLAUDE.md`, `.almanac/README.md`,
  `docs/python-port-live-agreement.md`, and the CodeAlmanac Cosmic Python
  guide.
- First implementation pressure is the Python spine: packaging, CLI entrypoint,
  application composition root, workspace service, and a test harness.
- Committed archive/docs baseline as `4520812`.
- Added the first Python scaffold: `pyproject.toml`, `src/codealmanac/`,
  `tests/`, `codealmanac` console script, `create_app(...)`, workspace registry
  service, wiki scaffold service, and build workflow-backed `init`.
- Verified first scaffold with `uv run pytest`, `uv run ruff check .`,
  `uv run codealmanac --help`, and an isolated live `codealmanac init` plus
  `codealmanac list` smoke run.
- Committed the first Python scaffold as `a803f63`.
- Review pass tightened the workspace registry write path: temp files now use
  unique same-directory names, duplicate workspace names compare
  case-insensitively, and selector helpers have explicit registry-entry types.
- Re-verified the review fix with `uv run pytest`, `uv run ruff check .`, and
  an isolated live `codealmanac init` plus `codealmanac list` smoke run.
- Sent a Relayforge Discord checkpoint through Doppler-injected
  `almanac/dev` credentials describing the Cosmic Python patterns applied so
  far: composition root, thin CLI adapter, repository/store boundary, and
  deferred Unit of Work machinery.
- Added slice-2 read-model plan in `docs/python-port/slice-2-read-model.md`.
- Added SQLite read-model services: `index` owns SQLite schema and query store,
  `search` and `pages` own user-facing read verbs, and CLI renders service
  results without knowing SQL exists.
- Added `python-frontmatter` after checking for a known frontmatter parsing
  library; Pydantic validates parsed metadata and `StrEnum` names wikilink
  kinds.
- Dogfood found a stale-schema bug against this repo's existing `.almanac/index.db`.
  The Python schema now uses a high version so old Node-era DBs rebuild cleanly.
- Verified slice-2 work with `uv run pytest`, `uv run ruff check .`, an isolated
  live `search`/`show`/`--mentions`/backlink smoke, and dogfood
  `codealmanac search python --limit 5` against this repo.
- Slice-2 review fixed two correctness issues: `show --body` now wins over
  metadata/field flags, and full index rebuild clears stale topic rows.
  Re-verified with 14 passing tests, ruff, isolated live `show --body --meta`,
  and dogfood search in this repo.
- Read Cosmic Python chapter 3 on abstractions before slice 3 and sent a
  Relayforge Discord checkpoint. The applied lesson: keep interrogation,
  decision, and mutation separate. Slice 3 therefore adds read-only
  `topics`/`health`; tag/frontmatter mutation stays out of scope.
- Added slice-3 read-only topics and health: `topics`, `topics show`,
  `topics show --descendants`, `health`, and `health --json`.
- Verified slice 3 with 17 passing tests, ruff, isolated live topics/health,
  and dogfood `codealmanac topics` plus `codealmanac health` in this repo.
  Dogfood health currently reports dead refs to archived TypeScript paths,
  which is expected product signal after the Python rewrite archive move.
- Slice-3 review fixed path safety and resilience: file refs now stay
  repo-relative (`/x` becomes `x`, `../x` is ignored), and malformed
  `topics.yaml` no longer breaks read commands. Re-verified with 19 tests,
  ruff, live `health --json`, and dogfood health.
- Added slice-4 `tag`/`untag` frontmatter mutation using `ruamel.yaml` for
  round-trip YAML editing. Verified body preservation, comment preservation,
  CRLF preservation, idempotence, no-frontmatter pages, CLI smoke, 24 tests,
  and ruff.
- Slice-4 review fixed frontmatter closing fences at EOF and no-op untag
  summaries. Re-verified with 25 tests, ruff, and a live EOF/no-op smoke.
- Read Cosmic Python chapter 5 on service-layer tests and sent a Relayforge
  Discord checkpoint. The applied lesson: behavior tests should mostly drive
  service-layer request models, with lower-level tests reserved for fragile
  implementation boundaries such as YAML round-tripping.
- Added slice-5 topic metadata mutation: `topics create`, `topics describe`,
  `topics link`, and `topics unlink`. The service owns parent existence,
  ad-hoc topic promotion, cycle rejection, and result enums; the wiki helper
  owns round-trip `.almanac/topics.yaml` mutation with `ruamel.yaml`.
- Verified slice 5 with 32 passing tests, ruff, `git diff --check`, isolated
  live topic create/describe/link/unlink/show, CLI help, and dogfood
  `codealmanac topics show cli --descendants` in this repo.
- Read Cosmic Python chapter 6 on Unit of Work and sent a Relayforge Discord
  checkpoint. The applied lesson: topic rewrite operations need an explicit
  operation boundary. Because filesystem writes cannot roll back like a
  database transaction, slice 6 builds a full page-rewrite plan before any
  write, writes `topics.yaml` first, then writes affected pages.
- Added slice-6 topic rewrite mutation: `topics rename` and `topics delete`.
  Rename refuses implicit merge into an existing topic; delete removes topic
  edges and page tags without deleting pages or child topics.
- Verified slice 6 with 39 passing tests, ruff, `git diff --check`, isolated
  live topic rename/delete/show, CLI help, and dogfood
  `codealmanac topics show cli --descendants` in this repo.
- Read Cosmic Python chapter 12 on CQRS and sent a Relayforge Discord
  checkpoint. The applied lesson: committed markdown is the write-side truth,
  `.almanac/index.db` is a derived read model, and `reindex` is an explicit
  command that mutates only that projection.
- Added slice-7 local maintenance commands: `build` and `reindex`. `build`
  refreshes deterministic wiki scaffold files, registers the workspace, and
  rebuilds the SQLite projection. `reindex` forces a full projection rebuild
  and supports JSON output.
- Verified slice 7 with 42 passing tests, ruff, `git diff --check`, isolated
  live build/reindex/search/help, and top-level `codealmanac --help` in this
  repo.
- Read Cosmic Python chapter 13 on dependency injection and sent a Relayforge
  Discord checkpoint. The applied lesson: keep dependencies explicit and wired
  in `app.py`; do not hide diagnostics probes in CLI code or add a DI framework.
- Added slice-8 `doctor`: a local diagnostics service and CLI command with text
  and JSON output. The Python v1 doctor checks package/runtime basics, registry
  path, current or named wiki resolution, index summary, and health problem
  count. It deliberately omits archived Node/npm/provider/hosted checks.
- Verified slice 8 with 46 passing tests, ruff, `git diff --check`, dogfood
  `doctor` text/JSON in this repo, and isolated live no-wiki plus built-wiki
  doctor checks.
- Read Cosmic Python chapter 4 on service layers and sent a Relayforge Discord
  checkpoint. The applied lesson: `serve` is an HTTP entrypoint over a viewer
  service, not a second parser, SQLite client, or CLI shell-out.
- Added slice-9 local `serve`: FastAPI server adapter, Uvicorn CLI runtime,
  `ViewerService`, explicit Pydantic viewer DTOs, markdown-it-py rendering with
  HTML disabled, and bundled static assets.
- Verified slice 9 with 53 passing tests, ruff, `git diff --check`, live
  `codealmanac serve --port 49217`, API dogfood for overview/search/page,
  CLI help, serve help, and `uv build` wheel inspection confirming viewer
  assets are packaged. Browser-harness could not attach because Chrome requires
  the manual remote-debugging permission click.
- Slice-9 review fixed index freshness semantics exposed by `serve`.
  `ensure_fresh` now computes a source signature and skips SQLite projection
  writes when page fingerprints and `topics.yaml` are unchanged; `reindex`
  remains the explicit forced rebuild. Re-verified with 55 passing tests, ruff,
  live `codealmanac serve --port 49219`, API dogfood for overview/search/page,
  and a SQLite trigger proving warm read traffic did not rewrite `pages`.
- Read Cosmic Python chapters 6, 8, and 10 before the first lifecycle seam and
  sent a Relayforge Discord checkpoint for the Commands vs Events pattern. The
  applied lesson: future lifecycle starts are commands that fail loudly, while
  run-log entries are past-tense facts recorded by the `runs` service.
- Added slice-10 runs ledger and `jobs` read surface: `RunsService`, JSON/JSONL
  run storage under `.almanac/jobs/`, typed run records/events/status enums,
  and `codealmanac jobs`, `jobs show`, and `jobs logs`.
- Verified slice 10 with focused runs/CLI tests, 59 passing full tests, ruff,
  `git diff --check`, and an isolated live dogfood run that created a run
  through `RunsService` and read it back through `codealmanac jobs`, `jobs show`,
  `jobs logs`, and `jobs --json`.
- Read Cosmic Python chapter 11 on external events before the source-input
  slice and sent a Relayforge Discord checkpoint. The applied lesson: raw
  outside-world inputs should be translated at the boundary into typed messages
  before workflows or agents see them.
- Added slice-11 source input contracts: `SourcesService`, `SourceAddress`,
  `SourceRef`, `SourceBrief`, source kind/provenance enums, local path
  observations and fingerprints, GitHub PR/issue refs and URLs, generic web
  URLs, git range/diff refs, and transcript refs. URL decomposition uses
  `urlsplit`, while validity uses Pydantic `AnyHttpUrl`.
- Verified slice 11 with focused source tests, 64 passing full tests, ruff,
  `git diff --check`, and a live service dogfood run that resolved a mixed
  source input tuple into typed source briefs.
- Read Cosmic Python chapters 4 and 13 before the harness seam and sent a
  Relayforge Discord checkpoint. The applied lesson: use cases belong behind
  services/workflows, while `app.py` wires dependencies.
- Added slice-12 harness contracts: `HarnessKind`, `HarnessRunStatus`,
  `HarnessReadiness`, `HarnessRunResult`, `RunHarnessRequest`,
  `HarnessAdapter`, and `HarnessesService`.
- Verified slice 12 with focused harness tests, 68 passing full tests, ruff,
  `git diff --check`, and a live fake-adapter dogfood run through
  `HarnessesService.check()` and `HarnessesService.run(...)`.
- Read Cosmic Python chapters 8 and 10 before wiring `ingest`. The applied
  lesson: `RunIngestRequest` is a command that fails loudly, while run ledger
  entries are events that record facts.
- Added slice-13 internal ingest workflow. It starts a run, resolves sources,
  renders a Pydantic JSON prompt payload, calls the harness service, validates
  changed files under `.almanac/`, refreshes the index, and marks the run done
  or failed.
- Refactored the app composition surface to `app.workflows.build` and
  `app.workflows.ingest`, matching the live agreement.
- Verified slice 13 with focused ingest/harness tests, 73 passing full tests,
  ruff, `git diff --check`, and an isolated fake-harness dogfood run that wrote
  a wiki page, refreshed the index, and read back search plus run-log state.
- Read Cosmic Python chapter 3 before the first concrete harness adapter and
  sent a Relayforge Discord checkpoint. The applied lesson: workflows depend on
  the `HarnessAdapter` abstraction while Claude subprocess details stay in
  `integrations/harnesses/claude`.
- Added slice-14 Claude CLI adapter. It uses `claude auth status` for readiness,
  `claude -p --output-format json` for runs, Pydantic models for external JSON,
  and git porcelain status snapshots to report changed files.
- Added an architecture test that prevents `cli/`, `workflows/`, and
  `services/` from importing concrete integrations.
- Dogfooded real Claude ingest in a temp Git repo. Claude wrote one
  `.almanac/pages` page, ingest finished successfully, the index refreshed to
  two pages, and search found the new page. The run exposed a naming prompt bug
  (`almanac CLI`), so the ingest prompt now states the public CLI name is
  `codealmanac`, never `almanac` or `alm`.
- Read Cosmic Python chapter 6 before hardening ingest mutation safety and sent
  a Relayforge Discord checkpoint. The applied lesson: a lifecycle write needs
  a stable operation snapshot, but filesystem writes cannot honestly roll back
  like database transactions.
- Added slice-15 ingest mutation safety. `WorkspaceChangeProbe` is a
  workspace-owned port, `GitWorkspaceChangeProbe` parses `git status
  --porcelain=v1 -z --untracked-files=all`, and `IngestMutationPolicy` requires
  Git change tracking, clean `.almanac/` preflight, and no non-wiki mutations
  during the harness run.
- Verified the slice-15 focused behavior with parser, ingest workflow, and
  architecture tests. The workflow allows pre-existing dirty app files when
  unchanged, rejects harness mutation to dirty app files, rejects dirty
  `.almanac/` preflight, and rejects non-Git lifecycle writes.
- Dogfooded slice-15 in a temp Git repo with a dirty `src/app.py` and a fake
  harness writing `.almanac/pages/safety-dogfood.md`. The run finished `done`,
  `result.safety.changed_files` contained only the wiki page, `src/app.py`
  preserved the user's dirty edit, and search found `safety-dogfood`.
- Read Cosmic Python chapters 4 and 10 before exposing public ingest. No new
  pattern checkpoint was sent because the applied command-vs-event and thin
  service-layer lessons were already recorded in earlier slices.
- Added slice-16 public `codealmanac ingest`. The CLI adapts argv into
  `RunIngestRequest`, defaults `--using` to `claude`, accepts `--using codex`
  as the existing harness enum for future adapter parity, and renders a short
  run/source/wiki-change summary.
- Real CLI dogfood exposed two issues before the final success: Claude prompt
  input had to move from a positional argument to stdin because `--tools` is
  variadic, and workflow errors needed to include harness output text. Both are
  fixed and covered by focused tests.
- Dogfooded real `codealmanac ingest note.md --using claude` in a temp Git repo
  after backing up and restoring the local registry. Claude created
  `.almanac/pages/ingest-cli-thin-adapter.md`, search found
  `ingest-cli-thin-adapter`, and Git status showed only that wiki page changed.
- Read Cosmic Python chapter 2 before Codex adapter work and sent a Relayforge
  Discord checkpoint. The applied lesson: the port is the application-facing
  interface, adapters are concrete implementations behind it, and fakes are
  design feedback when they are hard to write.
- Added slice-17 Codex CLI adapter. `CodexCliHarnessAdapter` uses
  `codex login status` for readiness and `codex exec` for runs. It sends the
  prompt on stdin, requests ephemeral workspace-write execution, disables user
  MCP servers with `--config mcp_servers={}`, sets noninteractive approval via
  `--config approval_policy="never"`, and reads the final assistant message
  from `--output-last-message`.
- Moved shared command runner and Git-status delta helpers out of the Claude
  adapter into `integrations/harnesses/command.py` and
  `integrations/harnesses/git_status.py`, so Claude and Codex are peer adapters
  behind the same port.
- Real Codex smoke exposed that this installed `codex exec` rejects
  `--ask-for-approval` and `-a` even though broader help text advertises an
  approval option. The adapter uses the accepted config override instead.
- The first Codex dogfood attempt used `uv run --directory`, which changed the
  process cwd to the CodeAlmanac checkout instead of the temp repo. The run was
  interrupted, and its relevant generated page was kept as
  `.almanac/pages/codex-cli-harness-adapter.md`. Future temp-repo dogfood should
  call the venv `codealmanac` executable directly or otherwise preserve cwd.
- Corrected real `codealmanac ingest note.md --using codex` dogfood in a temp
  Git repo created `.almanac/pages/codex-adapter.md`, search found
  `codex-adapter`, and Git status showed only that wiki page changed.
- Review during slice-17 found an ingest safety ordering bug: failed harness
  results were validated before the after-run Git snapshot. The workflow now
  checks mutation safety before harness status, so failed providers cannot hide
  non-wiki file mutations behind an `ExecutionFailed`.
- Read the live agreement, lifecycle wiki pages, and archived Garden operation
  reference before slice 18. No new Cosmic checkpoint was sent because the
  service-layer, command/event, and adapter-port lessons were already being
  applied directly.
- Added slice-18 public `codealmanac garden`. `GardenWorkflow` prepares index
  and health context, records a run, validates clean `.almanac/` preflight,
  calls the selected harness, validates mutations, refreshes the index, and
  marks the run done or failed.
- Added packaged prompt resources under `src/codealmanac/prompts/`. Ingest and
  Garden now compose shared base doctrine plus operation-specific Markdown and
  typed runtime JSON through `PromptRenderer`.
- Generalized ingest mutation safety into `LifecycleMutationPolicy`, so Garden
  reuses the same Git snapshot guard without inheriting ingest-specific error
  language.
- Verified slice 18 with 101 passing tests, ruff, `git diff --check`, CLI
  help for top-level and `garden`, package build with prompt Markdown in the
  wheel, and real temp-repo `codealmanac garden --using codex` dogfood. The
  dogfood run added the existing `concepts` topic to
  `.almanac/pages/thin-dogfood-note.md` and changed no application files.
- Read the live agreement, current sync/product notes, and Cosmic Python
  chapter 13 before slice 19. The applied lesson: `app.py` wires transcript
  discovery adapters into the source service, while CLI only adapts flags into
  `RunSyncStatusRequest`.
- Added slice-19 read-only `codealmanac sync status`. It discovers local Codex
  and Claude transcript JSONL files, maps sessions back to repos with
  `.almanac/`, applies a quiet window, reads the per-repo sync cursor ledger,
  and reports ready/skipped/needs-attention status without invoking AI or
  writing wiki content.
- Added `services/sources/ports.py` and transcript discovery adapters under
  `integrations/sources/transcripts/`. Raw provider JSON stays at the
  integration edge and becomes typed `TranscriptCandidate` models before the
  sync workflow sees it.
- Added `humanfriendly` for `--quiet` duration parsing instead of hand-rolling
  a duration grammar.
- Deliberately did not expose full `codealmanac sync` execution in this slice.
  Safe execution needs provider transcript identity feedback from harness runs
  so sync can skip CodeAlmanac's own Ingest/Garden transcripts.
- Verified slice 19 with focused transcript discovery, sync workflow, CLI, and
  architecture tests, 107 passing full tests, ruff, `git diff --check`, CLI
  help/status smoke, package build, and an isolated synthetic Codex transcript
  dogfood.
- Added slice-20 harness transcript feedback. `HarnessRunResult` can now carry
  a typed `HarnessTranscriptRef`, and `RunRecord` persists it as
  `harness_transcript`.
- `RunsService.record_harness_transcript(...)` records provider transcript
  identity before a lifecycle run is marked done or failed. Ingest and Garden
  call it immediately after the harness returns, before mutation validation or
  provider-status validation.
- Claude attaches the structured `session_id` from `claude -p --output-format
  json`. Codex uses a best-effort local transcript lookup over `.codex/sessions`
  after `codex exec` starts, matching fresh JSONL session metadata by `cwd` and
  skipping subagent sessions.
- `codealmanac jobs show <run-id>` now displays the stored harness transcript
  session id and path when present.
- Verified slice 20 with focused runs, Ingest, Garden, Claude adapter, Codex
  adapter, and jobs CLI tests, full pytest, ruff, `git diff --check`, and a
  live temp-repo `jobs show` smoke that displayed the stored transcript id.
- Added slice-21 internal lifecycle transcript exclusion to `sync status`.
  `SyncWorkflow` now loads repo-local run records through `RunsService` and
  skips discovered transcripts that match a stored `harness_transcript` by
  provider kind plus session id or transcript path.
- The skip reason is `internal-lifecycle-transcript`. This keeps the
  read-only status gate aligned with the future write-capable sync path without
  starting Ingest yet.
- Verified slice 21 with focused sync workflow tests, 109 passing full tests,
  ruff, `git diff --check`, and an isolated `sync status` dogfood where
  `internal-session` was skipped and `ordinary-session` was ready.
- Added slice-22 foreground `codealmanac sync`. `SyncWorkflow.run(...)` reuses
  the status evaluator, calls `IngestWorkflow.run(...)` for each ready
  transcript, and advances `.almanac/jobs/sync-ledger.json` only after Ingest
  succeeds.
- Sync passes transcript source material as `transcript:<absolute path>` and
  adds cursor guidance telling Ingest which transcript line range is new.
- Deliberately kept pending cursor state out of this foreground slice. The
  archived TypeScript pending model requires a real background owner and
  reconciliation loop; without those, commit-after-success is the safer Unit of
  Work boundary.
- Verified slice 22 with focused sync workflow and CLI tests, 111 passing full
  tests, ruff, `git diff --check`, and an isolated foreground sync dogfood that
  wrote `foreground-sync-dogfood.md` and advanced the sync ledger.
- Added slice-23 local automation. `AutomationService` owns the scheduled task
  plan for `sync` and `garden`, while `LaunchdSchedulerAdapter` is a concrete
  port implementation that writes plist files through Python `plistlib` and
  calls launchctl.
- `codealmanac automation install|status|uninstall` now exists. Default
  install selects sync plus Garden; explicit task selection accepts only
  `sync` and `garden` in v1. Garden install resolves the current wiki root as
  launchd `WorkingDirectory`; status and uninstall can run outside a repo.
- Deliberately did not add update automation or legacy capture migration.
  Python `codealmanac update` and background sync reconciliation are separate
  product debts.
- Verified slice 23 with focused automation service, CLI automation, and
  architecture tests, 118 passing full tests, full ruff, `git diff --check`,
  and a safe `automation status --json` smoke under a temporary `HOME`.
  The smoke showed plist state and launchd loaded state are independent: a
  same-label job may be loaded even when the temp HOME has no plist.
- Added slice-24 Git source runtime. `SourceRuntime` snapshots now sit after
  `SourceBrief`, and `IngestWorkflow` includes both source briefs and runtime
  snapshots in the agent prompt.
- Added `SourceRuntimeAdapter` under `services/sources/ports.py` and a concrete
  Git CLI adapter under `integrations/sources/git/`. The adapter captures
  status, stats, diffs, and commit lists for `git:diff`, `git:diff:<target>`,
  and `git:range:<range>`.
- Deliberately did not add GitHub PR/issue fetching in slice 24. GitHub should
  reuse the same source-runtime port through `gh` or another local
  source-access adapter.
- Verified slice 24 with focused source, ingest, CLI ingest, and architecture
  tests, 120 passing full tests, full ruff, `git diff --check`, and a temp-repo
  dogfood where real Git runtime carried a dirty `git:diff` into the Ingest
  prompt before a fake harness wrote `git-runtime-dogfood.md`.
- Added slice-25 GitHub source runtime. `GitHubSourceRuntimeAdapter` reads PR
  and issue refs through GitHub CLI, validates `gh --json` output with Pydantic
  models, renders bounded source text, and returns `unavailable` runtime
  snapshots when local GitHub access is missing.
- Moved the shared subprocess runner from `integrations/harnesses/command.py`
  to `integrations/command.py` after GitHub became the second non-harness
  caller. Harness Git-status helpers remain under `integrations/harnesses/`.
- Verified slice 25 focused behavior with GitHub runtime, source service,
  ingest prompt, and architecture tests. Full verification and live dogfood are
  recorded in `verification-matrix.md`.
- Added slice-26 transcript source runtime. `TranscriptSourceRuntimeAdapter`
  resolves `transcript:<path>` refs, reads local provider JSONL through the
  `jsonlines` package, validates known Codex and Claude line shapes with
  Pydantic models, renders line-numbered source material, and truncates from
  the tail because sync transcript sources are append-only.
- Foreground sync now benefits from source runtime directly: it still passes
  `transcript:<absolute path>` and cursor guidance to Ingest, but the Ingest
  prompt also includes readable transcript content before the harness runs.
- Added slice-27 web source runtime. `WebSourceRuntimeAdapter` fetches generic
  `SourceKind.WEB_URL` refs with `httpx`, parses HTML/text material at the
  integration edge, validates the normalized response with Pydantic models,
  strips non-readable HTML nodes with Beautiful Soup, and returns bounded
  `SourceRuntime` snapshots or `unavailable` diagnostics for HTTP/binary
  failures.
- Verified slice 27 with focused web/source/ingest/architecture tests, 134
  passing full tests, full ruff, diff hygiene, package build, wheel dependency
  inspection, and a temp-repo dogfood where real `https://example.com/` content
  reached the Ingest prompt before a fake harness wrote
  `web-runtime-dogfood.md`.
- Added slice-28 filesystem source runtime. `FilesystemSourceRuntimeAdapter`
  reads selected path files and bounded directory material through the same
  source-runtime port, decodes text with `charset-normalizer`, applies
  gitignore-style directory filtering with `pathspec`, skips generated/private
  directories during traversal, and makes ordinary `note.md` Ingest inputs
  available in the prompt instead of skipped runtime metadata.
- Verified slice 28 with focused filesystem/source/ingest/architecture tests,
  140 passing full tests, full ruff, diff hygiene, package build plus wheel
  dependency inspection, and a temp-repo dogfood where local `notes.md` and
  `src/` inputs reached the Ingest prompt while `.gitignore`d text stayed out.
- Added slice-29 manual update command. `services/updates` now plans foreground
  package-manager updates from install metadata, supports uv tool and pip
  installs, refuses editable/source installs, and delegates metadata reads plus
  command execution to `integrations/updates/`.
- Verified slice 29 focused behavior with update service, CLI update, doctor,
  and architecture tests, focused ruff, and live editable-install checks:
  `update --check`, `update --check --json`, and default `update` which
  refused mutation with `run: git pull && uv sync`.
- Added slice-30 viewer file route. `ViewerService.file(...)` returns pages
  that mention a file or folder reference through the existing index mentions
  query. `/api/file?path=src/foo.py` and frontend `#/file/<path>` restore the
  old viewer graph-navigation behavior without reading repo source contents.
- Verified slice 30 focused behavior with viewer service/server tests and
  focused ruff before full verification.
- Added slice-31 Git-backed filesystem directory listing. Directory runtime now
  asks Git for `--cached --others --exclude-standard` files when the selected
  directory is inside a worktree, then falls back to the bounded Python/pathspec
  walk when Git cannot answer. Runtime metadata records `listing_source: git`
  or `listing_source: walk`.
- Sent a Relayforge Discord checkpoint for the Cosmic Python chapter 13 pattern
  applied in slice 31: explicit dependency on a `CommandRunner` abstraction
  instead of hardcoded subprocess calls or monkeypatching.
- Added slice-32 changed-first filesystem directory selection. Git-listed
  directories now ask `git status --porcelain=v1 -z --untracked-files=all` for
  the selected path, rank changed and untracked files before unchanged files,
  and annotate the runtime tree with `changed` or `unchanged` state.
- Dogfood against this repo's dirty `src/codealmanac/` directory selected the
  changed filesystem adapter and selector files first before unchanged
  `app.py` and `cli/main.py`, proving broad-directory prompt material now
  follows the current slice instead of alphabetical path order.
- Sent a Relayforge Discord checkpoint for the Cosmic Python chapter 5 pattern
  applied in slice 32: high-gear tests drive the source service runtime
  contract instead of freezing private selector helper details.
- Added slice-33 public contract guards. `tests/test_public_contract.py`
  verifies the only script entry point is `codealmanac`, hosted and alias
  commands are rejected by the parser, and the Python package does not expose
  `sdk` or `mcp` modules.
- Sent a Relayforge Discord checkpoint for the Cosmic Python chapter 4 pattern
  applied in slice 33: the CLI stays an outer adapter over local service-layer
  use cases rather than growing hosted product modes.
- Added slice-34 manual surface. `src/codealmanac/manual/` now packages the
  wiki-maintenance rulebook, `WikiService.initialize(...)` copies missing
  files into `.almanac/manual/`, `DiagnosticsService` reports bundled and
  workspace manual readiness, and lifecycle prompts point agents at the
  operation-specific manual files.
- Sent a Relayforge Discord checkpoint for the Cosmic Python chapter 13 pattern
  applied in slice 34: `ManualLibrary` is wired once in `app.py` and injected
  into services instead of making CLI/build/doctor locate resources directly.
- Added slice-35 sync pending claims. Foreground `sync` now writes a durable
  pending ledger entry before invoking Ingest, records owner/start/range
  fields, skips active pending transcript ranges, reports stale pending ranges
  as needs-attention, and clears pending fields on success or failure.
- Dogfood for slice 35 exposed a macOS temp-path mismatch: a ledger entry
  written with `/var/...` did not match transcript discovery returning
  `/private/var/...`. Sync ledger keys now use normalized paths, and lookup can
  match a stored entry by normalized app/session/transcript identity.
- Sent a Relayforge Discord checkpoint for the Cosmic Python chapter 6 pattern
  applied in slice 35: sync needs an explicit durable pending claim before the
  side-effecting Ingest run, so the cursor update has an atomic checkpoint.
- Added slice-36 run lifecycle state. `RunsService` now exposes
  `mark_running(...)`, `RunStore` enforces `queued -> running -> terminal`
  transitions, and Ingest/Garden mark run records running before their
  side-effecting work begins.
- Sent a Relayforge Discord checkpoint for the Cosmic Python chapter 7 pattern
  applied in slice 36: the run record is the consistency boundary for
  lifecycle state, so future sync reconciliation can trust status instead of
  inferring execution from logs.
- Added slice-37 sync pending run linkage. `IngestWorkflow` now has an internal
  `start(...)` plus `run_with_run(...)` split beneath the existing public
  `run(...)` method. Foreground `sync` creates the Ingest run, writes a pending
  ledger claim with `pending_run_id`, claimed byte size, prefix hash, and line
  range, then executes Ingest with that run id.
- Sync status now reports linked active runs as `sync-pending-run-active` and
  linked terminal done runs as `sync-pending-run-done`. Foreground sync
  reconciles terminal linked runs before cursor evaluation, promoting done
  pending cursors or clearing failed/cancelled pending claims so retry starts
  from the last successful cursor.
- Sent a Relayforge Discord checkpoint for the Cosmic Python chapter 8 pattern
  applied in slice 37: run lifecycle transitions are durable facts, and sync
  reconciliation reacts to those facts at the workflow boundary rather than
  hiding policy inside transcript adapters or CLI glue.
- Added slice-38 database boundary. `codealmanac.database` now owns SQLite
  connection setup, row factory/PRAGMA policy, parent directory creation, and
  typed migration application. `services/index/store.py` still owns the
  `index.db` schema, FTS/search/topic/health SQL, and row conversion.
- Added an architecture guard that rejects direct `sqlite3` imports outside
  `database/`. This keeps future stores from bypassing the shared SQLite
  mechanics while still allowing store-owned schemas and queries.
- Sent a Relayforge Discord checkpoint for the Cosmic Python chapter 2 and
  chapter 6 patterns applied in slice 38: the store remains the repository for
  product persistence behavior, while database mechanics and migration
  application are infrastructure owned by `database/`.
- Added slice-39 local config boundary. `services/config` now owns
  `~/.almanac/config.toml` and `.almanac/config.toml` parsing through
  `pydantic-settings`, validates values with a frozen settings model, and
  merges defaults, user config, and selected-project config before CLI flags
  apply.
- `ingest`, `garden`, `sync`, `sync status`, and `automation install` now
  resolve lifecycle defaults through `app.config` instead of embedding product
  defaults in argparse. The first supported config fields are
  `[harness].default` and `[sync].quiet`.
- User clarified after slice 39 that the Python rewrite is for new users, not
  backward compatibility with old TypeScript installs. The repo Almanac root
  must become configurable and default to `almanac/`, with `docs/almanac/` or
  `.almanac/` available only by configuration. At that point, hard-coded
  `.almanac/` assumptions in workspace paths, prompts, tests, safety checks,
  and dogfood docs became product debt, not the target shape.
- Added slice-40 CLI edge split. `src/codealmanac/cli/main.py` now only owns
  parser invocation, known error formatting, and app dispatch. Parser
  construction lives under `cli/parser/` and is split into lifecycle, wiki, and
  admin command domains. Dispatch and render moved out of `main.py` into
  `cli/dispatch/root.py` and `cli/render/root.py`; they remain broad but are no
  longer mixed into the process entrypoint.
- Added slice-41 configurable Almanac root. `services/workspaces` now owns
  repo-relative root validation and nearest-root discovery. New repos default
  to `almanac/`; `init --root docs/almanac` and explicit
  `init --root .almanac` are supported setup choices. The registry stores
  `almanac_root`, downstream services use `workspace.almanac_path`, sync
  transcript candidates carry `almanac_path`, project config lives under the
  configured root, run log references use the configured root, prompts/manual
  say "configured Almanac root", and index health no longer assumes
  `almanac_path.parent` is the repo root.
- Added slice-42 source runtime context. `InspectSourceRuntimeRequest` now
  carries `SourceRuntimeContext`, Ingest fills it from
  `workspace.almanac_root`, and filesystem directory runtime applies those
  ignored directories for both Git listing and Python/pathspec traversal. The
  filesystem adapter no longer hard-codes `almanac/`, `docs/almanac/`, or
  `.almanac/` as product roots.
- Added slice-43 scheduled sync retry policy. Automation now installs scheduled
  sync with a stable claim owner, a 24h pending timeout, and a failed-attempt
  budget of 3. `SyncLedgerEntry.failed_attempts` increments after failed
  transcript Ingest attempts and exhausted failed entries report
  `sync-retry-budget-exhausted` instead of retrying forever.
- Added slice-44 clean directory diversity. Filesystem runtime now ranks
  changed/untracked candidates first, then interleaves clean directory groups
  and prefers role-bearing files. Dogfood against `src/codealmanac/` now keeps
  the changed filesystem files first and then includes service/workflow groups
  instead of spending the bound on shallow package files.
- Added slice-45 viewer renderer token-safety tests. The local viewer rewrites
  wikilinks through `markdown-it-py` tokens, touches only inline text tokens,
  leaves inline/fenced code untouched, and relies on renderer escaping for link
  labels.
- Added slice-46 serve visual port. The local viewer now borrows the
  UseAlmanac alpine dashboard visual language while keeping CodeAlmanac's
  existing local wiki model: sidebar navigation, page/topic/search/file-reference
  routes, page graph context, and repo-owned read-only pages.
- Downloaded Bulletproof React Markdown reference into
  `docs/reference/bulletproof-react/` and added a CodeAlmanac note. It is a
  structure reference for future frontend growth, not a mandate to add
  React/Next.js to the current static viewer.
- Verified slice 46 with focused viewer/server tests, focused ruff, 221
  passing full tests, full ruff, `git diff --check`, `uv build`, wheel asset
  inspection, and browser-harness desktop/mobile checks.
- Added slice-47 viewer frontend modules. `app.js` is now a small ES module
  entrypoint, nested package assets under `server/assets/viewer/` split API,
  routing, shared DOM components, and screen renderers, and the FastAPI server
  validates nested asset paths before serving them.
- Verified slice 47 with 12 focused viewer/server tests, focused server ruff,
  222 passing full tests, full ruff, `git diff --check`, `uv build`, wheel
  inspection for nested viewer modules, and browser-harness desktop/mobile
  checks that loaded `/app.js` plus `/assets/viewer/*.js`.
- Slice-47 review fixed malformed hash handling. Route parsing now runs inside
  the viewer error boundary, and title updates use cached DOM elements instead
  of re-querying the document. The branch-head package build still includes all
  nested viewer modules.
- Added slice-48 update install dogfood. A wheel-installed pip venv and a
  throwaway uv tool install both report non-editable metadata correctly and
  plan the expected package-manager commands. Dogfood showed a successful uv
  upgrade can say `Nothing to upgrade`, so update run status now reports
  `completed` for exit code 0 instead of over-claiming `updated`.
- Added slice-49 CLI admin edge split. `doctor`, `update`, `jobs`, and
  `automation` now dispatch through `cli/dispatch/admin.py`; admin rendering
  lives in `cli/render/admin.py`; shared CLI config/duration helpers live in
  `cli/dispatch/config.py`. Architecture tests keep admin request/result types
  out of root dispatch/render, matching the Cosmic Python entrypoint-adapter
  reading from chapters 4 and 13.
- Added slice-50 index read views. `IndexStore` remains the facade and
  projection writer, while `services/index/views.py` owns read-only SQL for
  search, pages, topics, and health. Architecture tests keep the view module
  free of markdown loading, migrations, and write SQL, matching Cosmic Python
  chapter 12's read-view split without adding full CQRS machinery.

## Current Hypothesis

The read and organization paths now cover the main local wiki management loop:
search/show, topic reads, health, tag/untag, topic DAG mutation including
rename/delete, explicit `build`, `reindex`, `doctor`, and a first read-only
local `serve` viewer. The first lifecycle/runs spine now exists as a ledger and
read surface. Source inputs, prompt rendering, harness execution, mutation
safety, and run logging now have typed service/workflow boundaries. Claude and
Codex CLI adapters are wired through the app composition root. Public `ingest`
and `garden` commands reach their workflows without making the CLI an internal
API. Run records now move through queued, running, and terminal states under
the `runs` service. `sync status` now exposes read-only local transcript readiness behind the
same service/workflow/adapter boundaries, and it skips provider transcripts
that came from CodeAlmanac lifecycle runs. Lifecycle runs retain optional
provider transcript identity for that exclusion. Foreground `sync` now runs
ordinary Ingest work for ready transcripts, writes a durable pending claim
before Ingest, stores the linked run id plus claimed cursor, reconciles terminal
linked runs against run state, advances the sync ledger after success, and
reports stale or unreconciled pending work as needs-attention. Local automation now installs scheduler
entries for foreground sync and Garden through a service-owned task plan and a
launchd adapter. Git,
GitHub, transcript, web URL, and local path source refs now produce bounded
runtime snapshots before Ingest starts the harness. Manual `update` now exists
as a conservative package-manager command and does not install scheduled update
automation. The viewer file route is now graph navigation over indexed file
references, not source-code preview. Filesystem directory runtime now uses Git
listing inside worktrees before falling back to Python/pathspec traversal, and
Git-listed directories rank changed material before unchanged files. The
local-only public surface now has executable guards for hosted verbs,
compatibility aliases, SDK modules, and MCP modules. The manual surface now
exists as packaged doctrine plus workspace manual files without adding a public
command. The database spine now exists for SQLite connection
and migration mechanics, with `IndexStore` supplying the first store-owned
typed migration for the derived read model. Index read queries now live in
`services/index/views.py`, so projection writes and read-only views have
separate reasons to change. The local config seam now exists
for typed user/project TOML defaults, with no public `config` command or
hosted/account configuration surface. The target root has changed: new repos
should default to `almanac/` and all wiki docs plus local runtime artifacts
should resolve through the configured Almanac root.
The CLI edge now follows the same parser/dispatch/render package shape as the
sibling Almanac CLI, with architecture tests preventing `main.py` and parser
root from growing back into all-purpose modules. Admin dispatch/render is now
split by command domain for `doctor`, `update`, `jobs`, and `automation`, while
wiki/lifecycle dispatch stays in root until a concrete command change creates
pressure. The configured-root slice now
implements the new default `almanac/` root across setup, registry, index,
manual, runs, sync ledger, config, prompts, and lifecycle safety. Source
runtime now receives configured wiki-root ignore policy from Ingest rather than
guessing root names inside the filesystem adapter. Scheduled sync now remains
ordinary foreground sync but carries explicit unattended policy from automation
into the workflow request and durable ledger. Clean directory runtime now uses
adapter-local diversity selection before any future recency machinery. Viewer
wikilink rendering is now covered as a token-stream rewrite rather than a raw
HTML/string rewrite. The served viewer now has the intended visual direction:
UseAlmanac-style shell polish over CodeAlmanac's local sidebar/wiki graph IA,
not the hosted UseAlmanac page-list/search UX. The browser shell now has static
module boundaries that match the current UI size without adding React, Next.js,
or a build step. Slice 51 tightens that shell toward the earlier CodeAlmanac
sidebar interaction: repo-owned wiki rail wording, local knowledge graph scope,
active page/topic rail state, compact mobile rail density, and no
viewport-scaled type in served CSS.
Slice 52 adds manual drift diagnostics without changing the manual mutation
policy. `ManualLibrary.workspace_status(...)` now reports files that differ
from bundled package resources; `doctor` reports those differences as
informational review work while keeping missing manual files as build-fixable
problems. Build/init still copy missing manual files only and preserve existing
workspace manual text.
Slice 53 adds explicit registry cleanup to `codealmanac list`. Real-repo
source-runtime dogfood against `src/codealmanac/`, `services/sources/`, and
`integrations/sources/filesystem/` showed the current changed-then-diverse
selection was coherent enough for local v1. The stronger local-product gap was
registry hygiene: stale temp entries made `list` hard to use, while read
commands should not silently prune them. `WorkspacesService` now owns registry
status plus explicit drop/drop-missing use cases, and the CLI exposes
`list --json`, `list --drop <selector>`, and `list --drop-missing`.
Slice 54 hardens lifecycle run logs. `ingest` and `garden` now record the
returned harness status and first output line before mutation-safety validation
and harness success validation. Failed harness runs now leave an `output` event
before the terminal `error`, including the case where a failed harness also
mutates a non-wiki file and the run error correctly remains the safety failure.
Slice 55 turns that log line into a normalized harness event contract.
`HarnessRunResult.events` now carries typed text/tool/usage/warning/error/done
events. Current Codex and Claude CLI adapters emit terminal `done` events, and
`ingest`/`garden` persist all returned events in order before later validation.
This keeps `codex exec` acceptable for v1 while leaving a clean Codex
app-server trigger: port it when actual transcript event completeness matters.
Slice 56 shifts the work toward public-release proof. The old README still
advertised the Node/npm `almanac` and hosted-dashboard path, which would
mislead Python users. `README.md` now documents the Python `codealmanac` local
surface, `pyproject.toml` declares the README and license file, public-contract
tests guard the README against stale install language, and
`docs/python-port/public-release-readiness.md` names the release gate.
Slice 57 runs real Codex ingest dogfood through the Python service layer. The
first run proved the workflow, mutation safety, search/show, and jobs log path
with `CodexCliHarnessAdapter`, but `health` caught broken `[[workos]]` and
`[[autumn]]` page links. The fix stayed at the prompt/manual contract: page
wikilinks must resolve, and entity names stay plain text unless a real page
exists or is created in the same run. A second real Codex run on the same
source shape produced a health-clean page. The slice also removes predefined
empty scaffold topics so fresh init does not start with health noise.
Slice 58 runs real Claude ingest dogfood through the same Python service-layer
path. `ClaudeCliHarnessAdapter` wrote `incident-window-policy.md`, updated
`topics.yaml`, preserved mutation safety, recorded provider output in
`jobs logs`, and left `health --json` clean. The public CLI readback
(`jobs logs`, `search`, `show`, and `health --json`) worked against the temp
repo with an isolated registry. No prompt or code patch was needed.
Slice 59 runs real foreground sync dogfood against a transcript-shaped Codex
JSONL file in a temp home. Sync discovered one ready transcript, started real
Claude-backed Ingest run `ingest-20260629231810-40e74df3`, advanced the
sync ledger to `done`, then skipped the same transcript as `unchanged` on the
second status run. The generated `sync-workflow.md` page was health-clean, and
public CLI readback worked for `sync status`, `jobs logs`, `jobs show`,
`search`, `show`, and `health --json` when the unpublished branch was selected
with `uv run --project /Users/rohan/Desktop/Projects/codealmanac`.
Slice 60 reruns the current local `serve` viewer through browser-harness after
the lifecycle and sync evidence slices. A temp wiki with page links, topics,
searchable content, and file refs rendered correctly in desktop Chrome for the
overview, page, topic, search, and file routes. A 390px mobile page route also
rendered without horizontal overflow. No viewer code or CSS patch was needed.
Slice 61 runs the final package rehearsal from built artifacts. Wheel and
sdist builds passed after package metadata moved from deprecated license-table
syntax to SPDX `Apache-2.0` plus `license-files = ["LICENSE.md"]`. The
artifacts included README, license, server assets, manual files, prompts, and
the `codealmanac` console script. Clean Python 3.12.9 installs from both wheel
and sdist passed installed CLI smoke for `init`, `search`, `show`, `topics`,
`health`, `jobs`, `sync status`, `doctor`, and `serve`. A Python 3.11 install
attempt failed with the expected `requires-python >=3.12` guard.
Slice 62 cleans the release path after the package rehearsal exposed a
maintainer-facing mismatch. `RELEASE.md` still described the archived npm
release flow, so it now documents the Python/PyPI flow: pytest, ruff, diff
check, `uv build`, `uvx twine check`, clean wheel/sdist install smoke, and
`uvx twine upload`. `pyproject.toml` now includes PyPI-facing author,
keyword, classifier, repository, and issue metadata. The first classifier pass
included the old Apache license classifier, and setuptools rejected it because
PEP 639 license expressions supersede license classifiers. The final metadata
keeps SPDX `Apache-2.0` and removes the license classifier. Public-contract
tests guard the Python release guide and package metadata.
Slice 63 fixes a local diagnostics/read-model hygiene gap found by dogfooding
`codealmanac doctor` in this repo before the repo's default `almanac/` root had
been built. The old path treated a registered workspace as available if the
configured root directory existed, so `doctor` could create
`almanac/index.db`, then `list --json` would report that derived-only directory
as an available wiki. Root discovery and registry status now require a wiki
marker pair (`topics.yaml` plus `pages/`), `IndexStore` refuses to open
SQLite for a missing root, and `doctor` reports the missing registered root
without cascading into index/manual/health checks. This repo's `.gitignore`
also ignores default-root runtime artifacts under `almanac/`.
Slice 64 tightens the public README after release-surface review found that the
"What Gets Created" tree mixed `init` scaffold files with runtime artifacts.
A live temp-repo `codealmanac init` created `.gitignore`, `README.md`,
`topics.yaml`, `pages/getting-started.md`, and bundled manual files, but not
`config.toml`, `jobs/`, or `index.db`. The README now separates
`What Gets Created By Init` from `Runtime State`, and public-contract tests
guard that the init section stays source-only.
Slice 65 dogfoods the README quickstart itself. A fresh temp repo proved that
`codealmanac search "auth"` returns zero results immediately after `init`,
because the starter wiki contains `getting-started`, not an auth page. The
quickstart now uses `codealmanac search "getting"` so a new user sees the
starter page on the first search. Public-contract tests guard the quickstart
section against drifting back to a non-starter search term.
Slice 66 checks the README lifecycle examples against the source abstraction.
`codealmanac ingest docs/adr.md --using codex` parsed but resolved as a missing
path in this checkout because `docs/adr.md` does not exist. The README now uses
`codealmanac ingest README.md --using codex`, which resolves as a real
`path.file`, while `github:pr:123` remains valid as the supported GitHub PR
shorthand. Public-contract tests now parse the lifecycle examples and resolve
the documented source refs through `SourcesService`.
Slice 67 makes the next-agent brief part of the public continuation contract.
The brief had lagged behind the actual slice trail: its top checkpoint still
said slice 62 after slices 63 through 66 had landed. Public-contract tests now
discover the newest `docs/python-port/slice-N-*.md` file and require the
brief's current-state section to mention that slice number.
Slice 68 turns the public beta gate into a concrete audit. The new
`docs/python-port/public-beta-gate-audit.md` records status, evidence, and
remaining risk for every row in `public-release-readiness.md`. The audit says
the local product gates are mostly covered, but public beta should still wait
for a current-head package rehearsal and one more real lifecycle dogfood pass
against a non-toy project source shape. Public-contract tests now compare the
gate areas in the readiness doc against the audit so the audit cannot silently
fall out of coverage.
Slice 69 completes the current-head package rehearsal. `uv build` produced a
wheel and sdist under `/tmp/codealmanac-release-slice69`; `twine check` passed;
stdlib package inspection confirmed README, Apache-2.0 license metadata,
license file, server assets, manual files, and prompt files. Clean uv-managed
Python 3.12.9 environments installed both artifacts and ran installed CLI smoke
for `--help`, `init`, `search`, `show`, `topics`, `health`, `jobs`,
`sync status`, `doctor`, `serve`, and `update --check`. The shell did not have
`python3.12`, so the smoke used `uv venv --python 3.12`.
Slice 70 closes the remaining lifecycle dogfood blocker. A temp repo copied
real CodeAlmanac source-runtime, filesystem adapter, ingest workflow, prompt,
and live-agreement files, then public `codealmanac ingest ... --using claude`
created `almanac/pages/source-runtime-flow.md`. The page accurately described
`SourceAddress -> SourceRef -> SourceBrief -> SourceRuntime`, `SourcesService`,
filesystem runtime selection, ingest prompt consumption, and source-runtime
gotchas. `health --json` was clean and `jobs logs` recorded queued, running,
preflight, source resolution, runtime loading, Claude success, and done events.
The dogfood also exposed that default user config still pointed at
`~/.almanac/config.toml`, where this machine had stale old-product `[agent]`
config. The fix moves default user/global state to `~/.codealmanac/` while
keeping repo wiki roots under `almanac/`.
Slice 71 reruns current-head package proof after the slice 70 README and
state-path changes. `uv build` produced wheel and sdist artifacts under
`/tmp/codealmanac-release-slice71`; `twine check` passed; package inspection
confirmed Apache-2.0 metadata, `>=3.12`, README metadata containing
`~/.codealmanac/`, server assets, manual docs, prompts, and `core/paths.py`.
Clean Python 3.12.9 wheel and sdist installs ran installed CLI smoke for
`--help`, `init`, `search`, `show`, `topics`, `health`, `jobs`, `sync status`,
`doctor`, `update --check`, and live `serve` HTTP routes. Both installed
artifacts wrote registry state under `~/.codealmanac/registry.json` and did not
create `~/.almanac/registry.json` in the temp homes.

## Next Hypothesis

The next high-pressure product slice is release review and prompt-quality
dogfood, not another root or sync migration. Scheduled update checks should wait
for a notifier policy. The remaining source-runtime pressure is lifecycle
dogfood, not a missing selection mechanism. The remaining serve risk is polish
and product review of navigation density, especially the compact mobile rail.
Browser-harness should still verify visual changes, using an isolated temporary
Chrome profile with explicit `BU_CDP_URL` when the default Chrome profile
requests the remote-debugging Allow prompt.
After slice 48, the next update pressure is no longer install detection; it is
the product policy for notification cadence, dismissal, and release channels
before any scheduled update automation exists. After slice 49, the next CLI
pressure is not "split every file"; it is to wait for wiki or lifecycle command
changes that justify their own dispatch/render domains. After slice 50, index
refresh cost is still a dogfood question, not something the read-view split
pretends to solve.
After slice 55, the next Codex harness pressure is event completeness, not
parity for its own sake. `codex exec` remains a one-shot writer transport;
Codex app-server belongs back on the table when jobs need normalized text,
tool, usage, actor, or root-turn events from the run itself.
After slice 61, public release should be measured against
`docs/python-port/public-release-readiness.md`: package proof has passed, so
remaining work is release judgment and prompt-quality review from more real
source shapes.
After slice 68, release judgment is recorded in
`docs/python-port/public-beta-gate-audit.md`. The next product pressure is not
another architecture seam; it is current-head package rehearsal plus one more
real lifecycle dogfood run.
After slice 69, current-head package rehearsal is done. After slice 70, the
remaining public-beta implementation gate is also covered. After slice 71,
package proof is current again after the state-path change. The next pressure
is release operations: version/changelog, PyPI credentials, and the human
publish decision. Any package data, prompt, manual, README, server asset, or
installed-behavior change before publish should trigger another package/install
smoke.
Slice 72 reopens architecture quality work under the new active goal. The CLI
root dispatcher is now a small delegator, lifecycle commands live in
`cli/dispatch/lifecycle.py`, and wiki/read commands live in
`cli/dispatch/wiki.py`. Architecture tests require the domain dispatch files to
exist, keep `dispatch/root.py` under 80 lines, and keep dispatch files under the
250-line split-review threshold. Focused ruff passed; focused pytest initially
failed only because `next-agent-brief.md` still pointed at slice 71. After the
brief update, focused pytest, focused ruff, `git diff --check`, full pytest
(`253 passed`), and full ruff all passed.
Slice 75 restores the queue core behind background jobs. `runs` now persists
`<run-id>.spec.json` next to run records, treats spec-backed queued records as
worker-eligible background work, selects the oldest eligible run, and uses a
per-wiki `worker.lock/owner.json` with stale-lock recovery. `RunQueueWorkflow`
drains in-process by dispatching persisted Ingest/Garden specs to the existing
operation workflows, which keeps prompt rendering, mutation safety, harness
events, index refresh, and terminal finalization in the shared lifecycle path.
Focused pytest covered run spec persistence, oldest selection, lock
exclusivity/stale recovery, cancelled queued skips, in-process ingest drain,
and architecture guards. Full pytest passed with 263 tests, full Ruff passed,
`git diff --check` passed, and a temp-repo app-level dogfood run queued an
ingest spec, drained one run, finished it as `done`, and found the generated
page through search.
Slice 76 adds detached worker spawning and explicit public background mode.
`RunQueueWorkflow` now accepts an injected worker spawner, `SubprocessRunWorkerSpawner`
launches `sys.executable -m codealmanac.cli.main __run-worker --cwd <repo>`,
and the hidden worker command drains the queue through the app composition root.
`codealmanac ingest --background` and `codealmanac garden --background` queue
spec-backed runs and spawn a worker; `--json` reports run id/status/child pid
for background starts. Focused tests cover the spawner command shape, workflow
background start, CLI background output, and hidden worker drain. Foreground
remains the default pending a separate product decision. Full pytest passed
with 268 tests, full Ruff passed, and `git diff --check` passed. Dogfood ran
the hidden worker command against an empty temp wiki and then ran public
`garden --background --json` in a non-Git temp repo; the public command queued a
run, spawned a child process, and the worker finalized the run as `failed` at
Git preflight without invoking a provider harness.
Slice 77 adds manual background sync. `RunSyncRequest` now carries
`SyncExecution`, `codealmanac sync --background` queues eligible transcript
ingests through `RunQueueWorkflow`, saves pending ledger claims before spawning
workers, and leaves plain `sync` foreground. Focused tests cover background
pending claims, queued run specs, no parent-process harness execution, spawn
failure cleanup, and CLI dispatch. Local automation still schedules foreground
sync until unattended background policy is explicitly reopened.
Focused pytest passed with 76 targeted tests, full pytest passed with 271 tests,
full Ruff passed, and `git diff --check` passed. Dogfood used an isolated HOME
with a fake Codex transcript and project-pinned `uv run`; public
`sync --background` discovered one transcript, queued one ingest, spawned a
worker, and the worker failed at non-Git preflight before any provider harness.
A follow-up foreground sync reconciled the pending claim into an `ingest-failed`
ledger entry.
