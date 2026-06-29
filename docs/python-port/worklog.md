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

## Current Hypothesis

The read and organization paths now cover the main local wiki management loop:
search/show, topic reads, health, tag/untag, and topic DAG mutation including
rename/delete, plus explicit `build`, `reindex`, and `doctor`. The next pressure
should move toward `serve` before AI lifecycle commands.

## Next Hypothesis

The next slice should probably add `serve`. It adds a human reader and will
require a careful framework/library choice plus browser verification. If `serve`
feels too large, add only the read-only HTTP/API spine first and defer visual
polish.
