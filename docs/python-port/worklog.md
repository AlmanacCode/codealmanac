# Python Port Worklog

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

## Current Hypothesis

The read and organization paths now cover the main local wiki management loop:
search/show, topic reads, health, tag/untag, topic DAG mutation including
rename/delete, explicit `build`, `reindex`, `doctor`, and a first read-only
local `serve` viewer. The first lifecycle/runs spine now exists as a ledger and
read surface. Source inputs, prompt rendering, harness execution, mutation
safety, and run logging now have typed service/workflow boundaries. Claude and
Codex CLI adapters are wired through the app composition root. Public `ingest`
and `garden` commands reach their workflows without making the CLI an internal
API. `sync status` now exposes read-only local transcript readiness behind the
same service/workflow/adapter boundaries, and it skips provider transcripts
that came from CodeAlmanac lifecycle runs. Lifecycle runs retain optional
provider transcript identity for that exclusion. Foreground `sync` now runs
ordinary Ingest work for ready transcripts and advances the sync ledger after
success. Local automation now installs scheduler entries for foreground sync
and Garden through a service-owned task plan and a launchd adapter. Git,
GitHub, transcript, web URL, and local path source refs now produce bounded
runtime snapshots before Ingest starts the harness. Manual `update` now exists
as a conservative package-manager command and does not install scheduled update
automation. The viewer file route is now graph navigation over indexed file
references, not source-code preview. Filesystem directory runtime now uses Git
listing inside worktrees before falling back to Python/pathspec traversal.

## Next Hypothesis

The next automation or sync slice should add background/pending semantics only
if it first adds a durable background owner and reconciliation loop. Scheduled
update checks should wait for real non-editable install dogfood. The remaining
source-runtime pressure is smarter file selection or ranking if dogfood shows
Git-listed directory inputs are still too noisy. The remaining serve risks are
markdown wikilink rewriting inside code spans and browser-harness verification
once Chrome allows remote debugging.
