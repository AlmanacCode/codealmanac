# Python Port Verification Matrix

Updated: 2026-06-29

This matrix tracks evidence for the full active goal. Empty or weak evidence
means the goal remains active.

| Requirement | Implementation evidence | Test/live evidence | Remaining risk |
|---|---|---|---|
| Fresh Python codebase | `pyproject.toml`, `src/codealmanac/`, `tests/` | `uv run pytest`, `uv run ruff check .` passed on 2026-06-29 | Lifecycle services remain pending. |
| Based on live agreement | `docs/python-port-live-agreement.md`, `src/codealmanac/app.py`, service/workflow packages | tests exercise CLI -> app -> services/workflows over local `.almanac/` | Need future architecture tests as more services appear. |
| Cosmic Python actively considered | `docs/reference/cosmic-python/`, `docs/python-port/`, composition root, service-layer tests, store boundary, Git snapshot policy for lifecycle writes | tests call workflow/service and CLI surfaces instead of private helpers; Relayforge Discord checkpoints sent | Need continued review before public lifecycle CLI. |
| CLI exists as `codealmanac` only | `[project.scripts] codealmanac = "codealmanac.cli.main:main"` plus argparse commands | `uv run codealmanac --help`, live `init`, `build`, `list`, `search`, `show`, `topics create/describe/link/unlink/rename/delete`, `reindex`, `doctor`, `serve` passed on 2026-06-29 | Many planned lifecycle commands remain pending. |
| SQLite-backed wiki/index behavior | `services/index`, `services/wiki`, `services/search`, `services/pages` | parser/index/search/show tests, stale-schema regression, stale-aware refresh regression, isolated live smoke, dogfood search | `refresh` still parses source markdown to compute signatures; optimize only after real large-repo pressure. |
| Workflows: build, ingest, sync, garden | `workflows/build`; internal `workflows/ingest`; `services/runs`; `services/sources`; `services/harnesses`; `IngestMutationPolicy` | build tests; runs service/jobs CLI tests; sources service tests; source-resolution dogfood; harness service tests; ingest workflow safety tests | Public `ingest`, `sync`, and `garden` execution remain pending. |
| Integrations behind service ports | ownership map drafted; source contracts ready for Git/GitHub/transcript adapters; Claude CLI implements `HarnessAdapter`; Git workspace change probe implements `WorkspaceChangeProbe`; architecture test guards import direction | sources, harness, Claude adapter, Git probe, ingest safety, and architecture tests; real Claude ingest dogfood | Codex adapter and source adapters remain pending. |
| Prompts/manual surfaces | pending | pending | Must avoid old npm prompt layout assumptions. |
| Tests and live verification | pytest/ruff configured in `pyproject.toml` | `uv run pytest`, `uv run ruff check .`, `uv run codealmanac --help`, live temp `init`/`list`/`search`/`show`, dogfood search, dogfood serve API passed | Browser-harness needs Chrome remote-debugging permission before visual UI verification can pass. |
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

## Gates For Slice-3 Review Fix

| Gate | Command | 2026-06-29 result |
|---|---|
| Formatting/lint | `UV_CACHE_DIR=/private/tmp/usealmanac-uv-cache uv run ruff check .` | passed |
| Tests | `UV_CACHE_DIR=/private/tmp/usealmanac-uv-cache uv run pytest` | 19 passed |
| Isolated live path safety | temp repo `health --json` with `/src/...` and `../...` refs | passed |
| Dogfood health | `uv run codealmanac health` in this repo | passed |

## Gates For Slice 4 Tag And Untag

| Gate | Command | 2026-06-29 result |
|---|---|
| Formatting/lint | `UV_CACHE_DIR=/private/tmp/usealmanac-uv-cache uv run ruff check .` | passed |
| Tests | `UV_CACHE_DIR=/private/tmp/usealmanac-uv-cache uv run pytest` | 24 passed |
| Isolated live tag/untag | temp repo `tag`, `show --topics`, `untag`, `show --topics` | passed |
| CLI surface smoke | `uv run codealmanac --help` | passed with `tag` and `untag` |

## Gates For Slice-4 Review Fix

| Gate | Command | 2026-06-29 result |
|---|---|
| Formatting/lint | `UV_CACHE_DIR=/private/tmp/usealmanac-uv-cache uv run ruff check .` | passed |
| Tests | `UV_CACHE_DIR=/private/tmp/usealmanac-uv-cache uv run pytest` | 25 passed |
| Live EOF/no-op smoke | temp repo `tag note concepts`, `untag note missing`, `cat page` | passed |

## Gates For Slice 5 Topic Metadata Mutation

| Gate | Command | 2026-06-29 result |
|---|---|---|
| Formatting/lint | `UV_CACHE_DIR=/private/tmp/usealmanac-uv-cache uv run ruff check .` | passed |
| Tests | `UV_CACHE_DIR=/private/tmp/usealmanac-uv-cache uv run pytest` | 32 passed |
| Diff hygiene | `git diff --check` | passed |
| Isolated live topic mutation | temp repo `topics create`, `topics describe`, `topics create`, `topics link`, `topics show`, `topics unlink`, `topics show` | passed |
| CLI help | `uv run codealmanac topics --help` | passed with `show`, `create`, `describe`, `link`, `unlink` |
| Dogfood topics read | `uv run codealmanac topics show cli --descendants` | passed |

## Gates For Slice 6 Topic Rewrite Mutation

| Gate | Command | 2026-06-29 result |
|---|---|---|
| Formatting/lint | `UV_CACHE_DIR=/private/tmp/usealmanac-uv-cache uv run ruff check .` | passed |
| Tests | `UV_CACHE_DIR=/private/tmp/usealmanac-uv-cache uv run pytest` | 39 passed |
| Diff hygiene | `git diff --check` | passed |
| Isolated live topic rewrite | temp repo `topics rename`, `topics show`, `topics delete`, `topics show`, `cat page` | passed |
| CLI help | `uv run codealmanac topics --help` | passed with `rename` and `delete` |
| Dogfood topics read | `uv run codealmanac topics show cli --descendants` | passed |

## Gates For Slice 7 Build And Reindex

| Gate | Command | 2026-06-29 result |
|---|---|---|
| Formatting/lint | `UV_CACHE_DIR=/private/tmp/usealmanac-uv-cache uv run ruff check .` | passed |
| Tests | `UV_CACHE_DIR=/private/tmp/usealmanac-uv-cache uv run pytest` | 42 passed |
| Diff hygiene | `git diff --check` | passed |
| Isolated live maintenance | temp repo `build`, write page, `reindex`, `search`, `--help` via `uv --project /Users/rohan/Desktop/Projects/codealmanac run ...` | passed |
| CLI help | `uv run codealmanac --help` | passed with `build` and `reindex` |

## Gates For Slice 8 Doctor

| Gate | Command | 2026-06-29 result |
|---|---|---|
| Focused diagnostics tests | `UV_CACHE_DIR=/private/tmp/usealmanac-uv-cache uv run pytest tests/test_diagnostics.py tests/test_cli.py::test_cli_doctor_reports_local_state tests/test_cli.py::test_cli_doctor_json_reports_no_wiki` | 4 passed |
| Full tests | `UV_CACHE_DIR=/private/tmp/usealmanac-uv-cache uv run pytest` | 46 passed |
| Formatting/lint | `UV_CACHE_DIR=/private/tmp/usealmanac-uv-cache uv run ruff check .` | passed |
| Diff hygiene | `git diff --check` | passed |
| Isolated live doctor | temp no-wiki `doctor --json`, then temp `build` and `doctor` via `uv --project /Users/rohan/Desktop/Projects/codealmanac run ...` | passed |
| Dogfood text doctor | `UV_CACHE_DIR=/private/tmp/usealmanac-uv-cache uv run codealmanac doctor` | passed; reported repo, index summary, and 125 health problems |
| Dogfood JSON doctor | `UV_CACHE_DIR=/private/tmp/usealmanac-uv-cache uv run codealmanac doctor --json` | passed |
| CLI help | `UV_CACHE_DIR=/private/tmp/usealmanac-uv-cache uv run codealmanac --help` | passed with `doctor` |

## Gates For Slice 9 Serve

| Gate | Command | 2026-06-29 result |
|---|---|---|
| Focused serve tests | `UV_CACHE_DIR=/private/tmp/usealmanac-uv-cache uv run pytest tests/test_viewer_service.py tests/test_server.py tests/test_cli.py::test_cli_help_includes_serve` | 7 passed |
| Full tests | `UV_CACHE_DIR=/private/tmp/usealmanac-uv-cache uv run pytest` | 53 passed |
| Formatting/lint | `UV_CACHE_DIR=/private/tmp/usealmanac-uv-cache uv run ruff check .` | passed |
| Diff hygiene | `git diff --check` | passed |
| Live serve API | `UV_CACHE_DIR=/private/tmp/usealmanac-uv-cache uv run codealmanac serve --port 49217`, then curl `/api/overview`, `/api/search?q=python`, `/api/page/python-core-port`, `/app.js` | passed; server stopped after checks |
| CLI help | `UV_CACHE_DIR=/private/tmp/usealmanac-uv-cache uv run codealmanac --help` and `uv run codealmanac serve --help` | passed |
| Package assets | `UV_CACHE_DIR=/private/tmp/usealmanac-uv-cache uv build --out-dir /tmp/codealmanac-build`, inspect wheel names | passed; `server/assets/index.html`, `app.css`, and `app.js` included |
| Browser harness | `browser-harness` navigation to `http://127.0.0.1:49217` | blocked by Chrome remote-debugging permission prompt |

## Gates For Slice-9 Review Fix

| Gate | Command | 2026-06-29 result |
|---|---|---|
| Focused freshness/server tests | `UV_CACHE_DIR=/private/tmp/usealmanac-uv-cache uv run pytest tests/test_read_model.py tests/test_viewer_service.py tests/test_server.py` | 12 passed |
| Full tests | `UV_CACHE_DIR=/private/tmp/usealmanac-uv-cache uv run pytest` | 55 passed |
| Formatting/lint | `UV_CACHE_DIR=/private/tmp/usealmanac-uv-cache uv run ruff check .` | passed |
| Live serve API | `UV_CACHE_DIR=/private/tmp/usealmanac-uv-cache uv run codealmanac serve --port 49219`, then request `/api/overview`, `/api/search?q=python`, `/api/page/almanac-serve`, `/app.js` | passed; server stopped after checks |
| Warm-read rewrite check | SQLite trigger on derived `pages` table while hitting live serve API routes | passed; `serve_rewrites_after_warm_index=0` |

## Gates For Slice 10 Runs Ledger

| Gate | Command | 2026-06-29 result |
|---|---|---|
| Focused runs tests | `UV_CACHE_DIR=/private/tmp/usealmanac-uv-cache uv run pytest tests/test_runs_service.py tests/test_cli.py::test_cli_jobs_inspects_local_run_records tests/test_cli.py::test_cli_help_includes_serve` | 5 passed |
| Full tests | `UV_CACHE_DIR=/private/tmp/usealmanac-uv-cache uv run pytest` | 59 passed |
| Formatting/lint | `UV_CACHE_DIR=/private/tmp/usealmanac-uv-cache uv run ruff check .` | passed |
| Diff hygiene | `git diff --check` | passed |
| Isolated live jobs CLI | temp repo `build`; create run through `RunsService`; read through `codealmanac jobs`, `jobs show`, `jobs logs`, `jobs --json` | passed; repo-relative `log_path` shown |

## Gates For Slice 11 Source Input Contracts

| Gate | Command | 2026-06-29 result |
|---|---|---|
| Focused sources tests | `UV_CACHE_DIR=/private/tmp/usealmanac-uv-cache uv run pytest tests/test_sources_service.py` | 5 passed |
| Full tests | `UV_CACHE_DIR=/private/tmp/usealmanac-uv-cache uv run pytest` | 64 passed |
| Formatting/lint | `UV_CACHE_DIR=/private/tmp/usealmanac-uv-cache uv run ruff check .` | passed |
| Diff hygiene | `git diff --check` | passed |
| Source-resolution dogfood | temp root with file, directory, missing path, GitHub issue URL, GitHub shorthand PR, git range, git diff, transcript ref, and uppercase HTTPS URL through `app.sources.resolve(...)` | passed; file fingerprint, missing-path provenance, GitHub identity, git refs, transcript ref, and normalized URL shown |

## Gates For Slice 12 Harness Contracts

| Gate | Command | 2026-06-29 result |
|---|---|---|
| Focused harness tests | `UV_CACHE_DIR=/private/tmp/usealmanac-uv-cache uv run pytest tests/test_harnesses_service.py` | 4 passed |
| Full tests | `UV_CACHE_DIR=/private/tmp/usealmanac-uv-cache uv run pytest` | 68 passed |
| Formatting/lint | `UV_CACHE_DIR=/private/tmp/usealmanac-uv-cache uv run ruff check .` | passed |
| Diff hygiene | `git diff --check` | passed |
| Harness service dogfood | fake Codex adapter through `HarnessesService.check()` and `HarnessesService.run(...)` | passed; readiness plus normalized run result shown |

## Gates For Slice 13 Internal Ingest Workflow

| Gate | Command | 2026-06-29 result |
|---|---|---|
| Focused ingest/harness tests | `UV_CACHE_DIR=/private/tmp/usealmanac-uv-cache uv run pytest tests/test_ingest_workflow.py tests/test_harnesses_service.py` | 9 passed |
| Full tests | `UV_CACHE_DIR=/private/tmp/usealmanac-uv-cache uv run pytest` | 73 passed |
| Formatting/lint | `UV_CACHE_DIR=/private/tmp/usealmanac-uv-cache uv run ruff check .` | passed |
| Diff hygiene | `git diff --check` | passed |
| Internal ingest dogfood | temp repo `build`; fake Codex harness writes `.almanac/pages/dogfood-ingest.md`; `app.workflows.ingest.run(...)`; search and run-log readback | passed; run `done`, 2 indexed pages, new page first in search, source JSON present in prompt |

## Gates For Slice 14 Claude CLI Adapter

| Gate | Command | 2026-06-29 result |
|---|---|---|
| Focused adapter/ingest tests | `UV_CACHE_DIR=/private/tmp/usealmanac-uv-cache uv run pytest tests/test_architecture.py tests/test_claude_adapter.py tests/test_ingest_workflow.py` | 13 passed |
| Full tests | `UV_CACHE_DIR=/private/tmp/usealmanac-uv-cache uv run pytest` | 81 passed |
| Formatting/lint | `UV_CACHE_DIR=/private/tmp/usealmanac-uv-cache uv run ruff check .` | passed |
| Diff hygiene | `git diff --check` | passed |
| Default adapter readiness dogfood | `create_app().harnesses.check()` | passed; Claude available via `claude.ai` |
| Real Claude ingest dogfood | temp Git repo; `app.workflows.ingest.run(..., harness=HarnessKind.CLAUDE)` | passed; one `.almanac/pages` file changed, run `done`, index refreshed, search found page |

## Gates For Slice 15 Ingest Mutation Safety

| Gate | Command | 2026-06-29 result |
|---|---|---|
| Focused mutation tests | `UV_CACHE_DIR=/private/tmp/usealmanac-uv-cache uv run pytest tests/test_git_workspace_probe.py tests/test_ingest_workflow.py tests/test_architecture.py` | 12 passed |
| Policy coverage | ingest workflow tests | passed; dirty app files allowed when unchanged, dirty app mutation rejected, dirty `.almanac/` rejected, non-Git ingest rejected |
| Architecture guard | `tests/test_architecture.py` | passed; CLI/workflows/services do not import integrations |
| Live safety dogfood | temp Git repo with dirty `src/app.py`; fake harness wrote `.almanac/pages/safety-dogfood.md`; `app.workflows.ingest.run(...)`; search readback | passed; run `done`, safety changed files only wiki page, dirty app file preserved, search found page |
