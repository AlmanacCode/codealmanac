# Python Port Verification Matrix

Updated: 2026-06-29

This matrix tracks evidence for the full active goal. Empty or weak evidence
means the goal remains active.

| Requirement | Implementation evidence | Test/live evidence | Remaining risk |
|---|---|---|---|
| Fresh Python codebase | `pyproject.toml`, `src/codealmanac/`, `tests/` | `uv run pytest`, `uv run ruff check .` passed on 2026-06-29 | Lifecycle services remain pending. |
| Based on live agreement | `docs/python-port-live-agreement.md`, `src/codealmanac/app.py`, service/workflow packages | tests exercise CLI -> app -> services/workflows over local `.almanac/` | Need future architecture tests as more services appear. |
| Cosmic Python actively considered | `docs/reference/cosmic-python/`, `docs/python-port/`, composition root, service-layer tests, store boundary | tests call workflow/service and CLI surfaces instead of private helpers; Relayforge Discord checkpoint sent | Need deeper transaction/freshness review before lifecycle writes. |
| CLI exists as `codealmanac` only | `[project.scripts] codealmanac = "codealmanac.cli.main:main"` plus argparse commands | `uv run codealmanac --help`, live `init`, `list`, `search`, `show` passed on 2026-06-29 | Many planned commands remain pending. |
| SQLite-backed wiki/index behavior | `services/index`, `services/wiki`, `services/search`, `services/pages` | parser/index/search/show tests, stale-schema regression, isolated live smoke, dogfood search | Index currently rebuilds on every read command; optimize after review or real perf pressure. |
| Workflows: build, ingest, sync, garden | pending | pending | Not scaffolded. |
| Integrations behind service ports | ownership map drafted | pending | Ports/adapters not implemented yet. |
| Prompts/manual surfaces | pending | pending | Must avoid old npm prompt layout assumptions. |
| Tests and live verification | pytest/ruff configured in `pyproject.toml` | `uv run pytest`, `uv run ruff check .`, `uv run codealmanac --help`, live temp `init`/`list`/`search`/`show`, dogfood search passed | Need broader live checks as commands land. |
| Frequent review | slice-1 review fix hardened registry temp writes and typed selector helpers | `uv run pytest`, `uv run ruff check .`, live temp `init`/`list` passed after review fix | Need the same checkpoint discipline after each meaningful slice. |
| No hosted CLI/MCP/SDK/aliases | live agreement records exclusion | pending | Need tests/rg checks once CLI exists. |

## Gates For First Slice

| Gate | Command | 2026-06-29 result |
|---|---|
| Formatting/lint | `uv run ruff check .` | passed |
| Tests | `uv run pytest` | 6 passed |
| CLI import | `uv run codealmanac --help` | passed |
| Live init smoke | `HOME=<tmp>/home uv run codealmanac init <temp repo>` | passed |

## Gates For Slice-1 Review Fix

| Gate | Command | 2026-06-29 result |
|---|---|
| Formatting/lint | `uv run ruff check .` | passed |
| Tests | `uv run pytest` | 6 passed |
| Live init/list smoke | isolated temp `codealmanac init` then `codealmanac list` | passed |

## Gates For Slice 2 Read Model

| Gate | Command | 2026-06-29 result |
|---|---|
| Formatting/lint | `UV_CACHE_DIR=/private/tmp/usealmanac-uv-cache uv run ruff check .` | passed |
| Tests | `UV_CACHE_DIR=/private/tmp/usealmanac-uv-cache uv run pytest` | 13 passed |
| Isolated live read smoke | temp repo `search --mentions`, `show --backlinks`, `show --files` | passed |
| Dogfood search | `uv run codealmanac search python --limit 5` in this repo | passed |
| Dogfood empty mentions | `uv run codealmanac search --mentions docs/python-port-live-agreement.md --limit 5` | passed with `# 0 results` |

## Gates For Slice-2 Review Fix

| Gate | Command | 2026-06-29 result |
|---|---|
| Formatting/lint | `UV_CACHE_DIR=/private/tmp/usealmanac-uv-cache uv run ruff check .` | passed |
| Tests | `UV_CACHE_DIR=/private/tmp/usealmanac-uv-cache uv run pytest` | 14 passed |
| Isolated live CLI precedence | temp repo `show auth-flow --body --meta` | body output passed |
| Dogfood search | `uv run codealmanac search python --limit 3` in this repo | passed |

## Gates For Slice 3 Topics And Health

| Gate | Command | 2026-06-29 result |
|---|---|
| Formatting/lint | `UV_CACHE_DIR=/private/tmp/usealmanac-uv-cache uv run ruff check .` | passed |
| Tests | `UV_CACHE_DIR=/private/tmp/usealmanac-uv-cache uv run pytest` | 17 passed |
| Isolated live topics/health | temp repo `topics`, `topics show auth`, `health --json` | passed |
| Dogfood topics | `uv run codealmanac topics` in this repo | passed |
| Dogfood health | `uv run codealmanac health` in this repo | passed; reports expected dead refs to archived TypeScript paths |
