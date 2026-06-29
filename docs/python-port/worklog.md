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

## Current Hypothesis

The read and organization paths now cover the main local wiki management loop:
search/show, topic reads, health, tag/untag, topic DAG mutation including
rename/delete, explicit `build`, `reindex`, `doctor`, and a first read-only
local `serve` viewer. The highest-risk serve/index review issue found so far is
fixed: read traffic no longer forces projection rewrites when the source wiki
is unchanged. The first lifecycle/runs spine now exists as a ledger and read
surface. Source inputs and harness execution now have typed service contracts,
but no AI-backed lifecycle workflow is wired yet.

## Next Hypothesis

The next slice should connect `sources`, `harnesses`, and `runs` into the first
`workflows/ingest` shape without exposing a misleading public command before it
can honestly execute work. The remaining serve risks are markdown wikilink
rewriting inside code spans, browser-harness verification once Chrome allows
remote debugging, and whether a source/file route belongs in the first viewer
shape before lifecycle commands.
