# Python Port Completion Audit

Date: 2026-06-30

## Verdict

The CodeAlmanac Python local product implementation is complete against the
active goal. Remaining work is public-release operations: version/changelog,
PyPI credentials, publish ownership, and the human publish decision.

## Requirement Audit

| Requirement | Evidence | Verification | Remaining Risk |
|---|---|---|---|
| Fresh Python codebase from scratch | `src/codealmanac/`, `pyproject.toml`, `tests/`, archived old code under `archive/code/` | `uv run pytest` and `uv run ruff check .` pass on current head | No implementation blocker. |
| Live agreement followed | `docs/python-port-live-agreement.md` records local-only v1, `codealmanac` command, no hosted CLI/MCP/SDK/aliases, `almanac/` repo root, `~/.codealmanac/` user state | public-contract tests enforce command/package/docs/state-path constraints | Future hosted work needs a new agreement. |
| Cosmic Python applied | `app.py` composition root, service packages, store boundaries, request models, adapter ports, `docs/reference/cosmic-python/CODEALMANAC.md` | tests exercise CLI-to-app-to-service flows; package smoke proves installed artifact behavior | Continue using the reference for future features. |
| CLI local product surface | parser/dispatch/render packages implement `init`, `build`, `list`, `search`, `show`, `topics`, `health`, `reindex`, `ingest`, `garden`, `sync`, `jobs`, `automation`, `doctor`, `serve`, and `update` | installed wheel/sdist smoke in slice 71 ran the core public commands from clean Python 3.12 environments | Release ops remain. |
| SQLite-backed wiki/index behavior | `services/index`, `services/wiki`, `services/search`, `services/pages`, `services/topics`, `database/` | full test suite covers parsing, indexing, search, mentions, backlinks, topics, health, and stale-root behavior | Large-repo performance remains future dogfood. |
| Workflows and integrations | `workflows/build`, `workflows/ingest`, `workflows/garden`, `workflows/sync`; source runtime adapters; Codex/Claude harness adapters; automation and update integrations | real Codex ingest, real Claude ingest, real sync, real non-toy source-shape ingest, installed package smoke, and full tests | More provider breadth can improve confidence later. |
| Prompts/manual surfaces | packaged `src/codealmanac/prompts/` and `src/codealmanac/manual/`; workspace materialization under `<almanac-root>/manual/` | package inspection confirms prompt/manual data; prompt/manual tests pass; lifecycle dogfood produced health-clean pages | Prompt quality improves through future use. |
| Viewer | static package-data viewer under `server/assets/`; local read-only server | browser proof in slice 60; installed smoke in slice 71 fetched `/api/overview` and viewer module | Future visual changes need browser-harness. |
| Tests and live verification | steering docs and verification matrix list every slice gate | current head: `uv run pytest` 249 passed, `uv run ruff check .` passed, public contract 23 passed, package smoke passed | Rerun package smoke before publish if package data changes. |
| No hosted CLI, MCP, SDK, or compatibility aliases | forbidden command/module tests and README/release-guide guards | `tests/test_public_contract.py` passes on current head | Any hosted surface requires explicit agreement change. |

## Completion Boundary

This audit does not claim the package has been published. It claims the local
Python product implementation, documentation, tests, ownership boundaries, and
verification matrix agree with the active goal.
