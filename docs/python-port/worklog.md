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

## Current Hypothesis

The read path now exists and should be reviewed before lifecycle commands. The
indexer deliberately rebuilds the read model on every read command for slice 2;
that is correct but not final for large repos.

## Next Hypothesis

The next slice should review and tighten the SQLite read model, then either add
`topics`/`health` on top of the same index or optimize freshness with
content-hash/incremental indexing if performance becomes the higher-risk
boundary.
