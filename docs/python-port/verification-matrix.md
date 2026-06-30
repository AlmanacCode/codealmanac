# Python Port Verification Matrix

Updated: 2026-06-30

This matrix tracks evidence for the full active goal. Empty or weak evidence
means the goal remains active.

| Requirement | Implementation evidence | Test/live evidence | Remaining risk |
|---|---|---|---|
| Fresh Python codebase | `pyproject.toml`, `src/codealmanac/`, `tests/` | `uv run pytest`, `uv run ruff check .` passed on 2026-06-30 | Remaining risk is continued product review, not a missing spine. |
| Based on live agreement | `docs/python-port-live-agreement.md`, `src/codealmanac/app.py`, service/workflow packages | tests exercise CLI -> app -> services/workflows over configurable local roots, defaulting to `almanac/` | Need future architecture tests as more services appear. |
| Cosmic Python actively considered | `docs/reference/cosmic-python/`, `docs/python-port/`, composition root, service-layer tests, store boundary, Git snapshot policy for lifecycle writes | tests call workflow/service and CLI surfaces instead of private helpers; Relayforge Discord checkpoints sent | Need continued review before public lifecycle CLI. |
| CLI exists as `codealmanac` only | `[project.scripts] codealmanac = "codealmanac.cli.main:main"` plus argparse commands | `uv run codealmanac --help`, live `init`, `build`, `ingest`, `garden`, foreground `sync`, `sync status`, `list`, `search`, `show`, `topics create/describe/link/unlink/rename/delete`, `reindex`, `doctor`, `serve`, `automation status`, `update --check`, non-editable pip/uv-tool `update` dogfood, and final wheel/sdist installed CLI smoke passed on 2026-06-30 | Scheduled update automation remains intentionally deferred pending notifier/check cadence, dismissal, and release-channel policy. |
| SQLite-backed wiki/index behavior | `services/index`, `services/wiki`, `services/search`, `services/pages` | parser/index/search/show tests, stale-schema regression, stale-aware refresh regression, isolated live smoke, dogfood search | `refresh` still parses source markdown to compute signatures; optimize only after real large-repo pressure. |
| Workflows: build, ingest, sync, garden | `workflows/build`; `workflows/ingest`; `workflows/garden`; `workflows/sync`; `services/runs`; `services/sources`; `services/harnesses`; `LifecycleMutationPolicy`; public `codealmanac ingest`, `codealmanac garden`, foreground `codealmanac sync`, and read-only `codealmanac sync status` | build tests; runs service/jobs CLI tests; sources service tests; transcript discovery tests; source-resolution dogfood; harness service tests; sync status and foreground sync tests; ingest/garden workflow safety tests; harness failure-log tests; harness transcript feedback tests; sync internal-exclusion tests; sync pending-claim tests; run lifecycle state tests; pending run-linkage tests; retry-budget tests; real Claude and Codex CLI ingest dogfood; real Codex Garden dogfood; synthetic transcript sync dogfood; real Codex-transcript-to-Claude-ingest sync dogfood; retry-budget CLI dogfood; failed-harness `jobs logs` dogfood; slice 70 real source-shape ingest dogfood | Workflow MVP is covered; remaining risk is continued prompt/product review under more real projects, not a public-beta blocker. |
| Integrations behind service ports | ownership map drafted; filesystem, Git, GitHub, transcript, and web runtime adapters implement `SourceRuntimeAdapter`; transcript discovery adapters implement `TranscriptDiscoveryAdapter`; Claude and Codex CLI implement `HarnessAdapter`; Git workspace change probe implements `WorkspaceChangeProbe`; architecture test guards import direction | sources, source runtime, transcript discovery, harness, Claude/Codex adapter, Git probe, ingest safety, sync status, sync run, filesystem diversity tests, and architecture tests; real Claude and Codex ingest dogfood; real filesystem/Git/GitHub/transcript/web runtime dogfood; source-runtime diversity dogfood; slice 70 non-toy source-shape dogfood | Source runtime MVP is covered; future work is incremental provider/source breadth. |
| Prompts/manual surfaces | `src/codealmanac/prompts/` package resources, `PromptRenderer`, `src/codealmanac/manual/` package resources, `<almanac-root>/manual/` build materialization, and doctor manual checks | prompt/manual tests; build and diagnostics tests; ingest and garden workflow prompt assertions; wheel inspection confirmed prompt and manual Markdown packaged; isolated live build/doctor dogfood passed; slice 70 source-runtime page passed health and manual review | Prompt and manual quality should keep improving through dogfood, but public-beta evidence is now sufficient. |
| Tests and live verification | pytest/ruff configured in `pyproject.toml` | `uv run pytest`, `uv run ruff check .`, `uv run codealmanac --help`, live temp `init`/`list`/`search`/`show`, dogfood search, dogfood serve API, viewer renderer token-safety tests, browser-harness desktop/mobile serve verification, and final wheel/sdist installed CLI smoke passed through slice 71 | Keep using browser-harness for future visual changes. |
| Frequent review | slice-1 review fix hardened registry temp writes and typed selector helpers | `uv run pytest`, `uv run ruff check .`, live temp `init`/`list` passed after review fix | Need the same checkpoint discipline after each meaningful slice. |
| No hosted CLI/MCP/SDK/aliases | live agreement records exclusion; `tests/test_public_contract.py` guards entry points, forbidden commands, package module names, README, release guide, package metadata, next-agent freshness, beta-audit coverage, and `~/.codealmanac/` user-state defaults | `uv run pytest tests/test_public_contract.py -q` passed with 23 tests on 2026-06-30; full `uv run pytest` and `uv run ruff check .` passed on 2026-06-30 | Future CLI expansion must keep the public-contract guard current. |

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

## Gates For Slice 16 Public Ingest CLI

| Gate | Command | 2026-06-29 result |
|---|---|---|
| Focused CLI/ingest/Claude tests | `UV_CACHE_DIR=/private/tmp/usealmanac-uv-cache uv run pytest tests/test_cli.py tests/test_ingest_workflow.py tests/test_claude_adapter.py tests/test_architecture.py` | passed before full verification |
| CLI help smoke | `UV_CACHE_DIR=/private/tmp/usealmanac-uv-cache uv run codealmanac --help` and `uv run codealmanac ingest --help` | passed; `ingest` appears with `--using`, `--title`, and `--guidance` |
| Claude stdin smoke | `printf 'Return exactly: ok' \| claude -p --output-format json --no-session-persistence --permission-mode acceptEdits --tools Read,Write,Edit,MultiEdit,Glob,Grep,LS` | passed; Claude returned JSON result `ok` |
| Real CLI ingest dogfood | temp Git repo; `codealmanac build`; commit wiki; `codealmanac ingest note.md --using claude`; search readback; restore user registry backup | passed; run `done`, search found `ingest-cli-thin-adapter`, Git status showed only `.almanac/pages/ingest-cli-thin-adapter.md` |

## Gates For Slice 17 Codex CLI Harness Adapter

| Gate | Command | 2026-06-29 result |
|---|---|---|
| Focused adapter/harness tests | `UV_CACHE_DIR=/private/tmp/usealmanac-uv-cache uv run pytest tests/test_ingest_workflow.py tests/test_codex_adapter.py tests/test_claude_adapter.py tests/test_harnesses_service.py tests/test_architecture.py` | 28 passed |
| Full tests | `UV_CACHE_DIR=/private/tmp/usealmanac-uv-cache uv run pytest` | 95 passed |
| Formatting/lint | `UV_CACHE_DIR=/private/tmp/usealmanac-uv-cache uv run ruff check .` | passed |
| Diff hygiene | `git diff --check` | passed |
| Codex final-message smoke | `printf 'Return exactly: ok' \| codex exec --config 'mcp_servers={}' --config 'approval_policy="never"' --cd <repo> --ephemeral --sandbox workspace-write --ignore-rules --color never --output-last-message <tmp> -` | passed; final message file contained `ok` |
| Real CLI ingest dogfood | temp Git repo; temp `HOME`; real `CODEX_HOME`; venv `codealmanac build`; commit wiki; `codealmanac ingest note.md --using codex`; search readback | passed; run `done`, search found `codex-adapter`, Git status showed only `.almanac/pages/codex-adapter.md` |
| Failed-provider mutation safety | focused ingest workflow regression | passed; failed harness that mutates `src/app.py` raises mutation-safety failure before provider-status failure |

## Gates For Slice 18 Garden Workflow

| Gate | Command | 2026-06-29 result |
|---|---|---|
| Focused Garden/prompt/CLI tests | `uv run pytest tests/test_prompts.py tests/test_garden_workflow.py tests/test_cli.py::test_cli_garden_runs_workflow_with_selected_harness tests/test_cli.py::test_cli_help_includes_serve tests/test_ingest_workflow.py tests/test_architecture.py` | 18 passed |
| Full tests | `uv run pytest` | 101 passed |
| Formatting/lint | `uv run ruff check src tests` | passed |
| Diff hygiene | `git diff --check` | passed |
| CLI help smoke | `uv run codealmanac --help` and `uv run codealmanac garden --help` | passed; `garden` appears with `--using`, `--title`, and `--guidance` |
| Package prompts | `uv build --out-dir /tmp/codealmanac-build`, inspect wheel names | passed; base and operation prompt Markdown included |
| Real CLI Garden dogfood | temp Git repo; temp `HOME`; real `CODEX_HOME`; venv `codealmanac build`; commit wiki; `codealmanac garden --using codex`; search and job-log readback | passed; run `done`, added `concepts` topic to `.almanac/pages/thin-dogfood-note.md`, Git status showed only that wiki page changed |

## Gates For Slice 19 Sync Status

| Gate | Command | 2026-06-29 result |
|---|---|---|
| Focused sync tests | `uv run pytest tests/test_transcript_discovery.py tests/test_sync_workflow.py tests/test_cli.py::test_cli_sync_status_reports_ready_transcripts tests/test_cli.py::test_cli_help_includes_serve tests/test_architecture.py` | 8 passed |
| Full tests | `uv run pytest` | 107 passed |
| Formatting/lint | `uv run ruff check src tests` | passed |
| Diff hygiene | `git diff --check` | passed |
| CLI help/status smoke | `uv run codealmanac --help`, `uv run codealmanac sync status --help`, `uv run codealmanac sync status --quiet 0s --from codex --json` | passed |
| Package build | `uv build --out-dir /tmp/codealmanac-build` | passed |
| Isolated sync status dogfood | temp repo; temp `HOME`; synthetic Codex transcript under `.codex/sessions`; venv `codealmanac sync status --from codex --quiet 0s`; JSON readback | passed; scanned 1, eligible 1, ready `sync-dogfood-session` lines 1-2 |

## Gates For Slice 20 Harness Transcript Feedback

| Gate | Command | 2026-06-29 result |
|---|---|---|
| Focused feedback tests | `uv run pytest tests/test_runs_service.py tests/test_ingest_workflow.py tests/test_garden_workflow.py tests/test_claude_adapter.py tests/test_codex_adapter.py tests/test_cli.py::test_cli_jobs_inspects_local_run_records` | 29 passed |
| Full tests | `uv run pytest` | 107 passed |
| Formatting/lint | `uv run ruff check src tests` | passed after import sort |
| Diff hygiene | `git diff --check` | passed |
| Live jobs show smoke | temp repo run record with `harness_transcript`; `codealmanac jobs show <run-id>` | passed; displayed `harness_transcript: codex codex-smoke-session` |

## Gates For Slice 21 Sync Internal Transcript Exclusion

| Gate | Command | 2026-06-29 result |
|---|---|---|
| Focused sync tests | `uv run pytest tests/test_sync_workflow.py` | 5 passed |
| Full tests | `uv run pytest` | 109 passed |
| Formatting/lint | `uv run ruff check src tests` | passed |
| Diff hygiene | `git diff --check` | passed |
| Isolated sync-status dogfood | temp repo with one internal Codex transcript and one ordinary Codex transcript | passed; scanned 2, eligible 1, skipped `internal-session`, ready `ordinary-session` |

## Gates For Slice 22 Foreground Sync

| Gate | Command | 2026-06-29 result |
|---|---|---|
| Focused sync/CLI tests | `uv run pytest tests/test_sync_workflow.py tests/test_cli.py::test_cli_sync_status_reports_ready_transcripts tests/test_cli.py::test_cli_sync_runs_ingest_for_ready_transcripts` | 8 passed |
| Full tests | `uv run pytest` | 111 passed |
| Formatting/lint | `uv run ruff check src tests` | passed |
| Diff hygiene | `git diff --check` | passed |
| Isolated foreground sync dogfood | temp repo, fake Codex transcript, fake Codex harness, foreground `codealmanac sync --from codex --quiet 0s --using codex` | passed; wrote `foreground-sync-dogfood.md`, started one Ingest run, and advanced the sync ledger |

## Gates For Slice 23 Local Automation

| Gate | Command | 2026-06-29 result |
|---|---|---|
| Focused automation tests | `uv run pytest tests/test_automation_service.py tests/test_cli.py::test_cli_help_includes_serve tests/test_cli.py::test_cli_automation_install_status_and_uninstall tests/test_architecture.py` | 9 passed |
| Formatting/lint | `uv run ruff check src/codealmanac/services/automation src/codealmanac/integrations/automation src/codealmanac/app.py src/codealmanac/cli/main.py tests/test_automation_service.py tests/test_cli.py` | passed |
| Full tests | `uv run pytest` | 118 passed |
| Formatting/lint | `uv run ruff check src tests` | passed |
| Diff hygiene | `git diff --check` | passed |
| Automation status smoke | temp `HOME`; `uv run codealmanac automation status --json` | passed; no plist installed in temp HOME, launchd loaded state reported independently by label |

## Gates For Slice 24 Git Source Runtime

| Gate | Command | 2026-06-29 result |
|---|---|---|
| Focused source/runtime tests | `uv run pytest tests/test_sources_service.py tests/test_ingest_workflow.py tests/test_cli.py::test_cli_ingest_runs_workflow_with_selected_harness tests/test_architecture.py` | 19 passed |
| Focused lint | `uv run ruff check src/codealmanac/services/sources src/codealmanac/integrations/sources src/codealmanac/workflows/ingest src/codealmanac/app.py tests/test_sources_service.py tests/test_ingest_workflow.py` | passed |
| Full tests | `uv run pytest` | 120 passed |
| Full lint | `uv run ruff check src tests` | passed |
| Diff hygiene | `git diff --check` | passed |
| Git source runtime dogfood | temp Git repo, dirty `src/auth.py`, real Git runtime adapter, fake harness, `app.workflows.ingest.run(inputs=("git:diff",))`, search readback | passed; prompt contained `diff --git` and changed text, run `done`, search found `git-runtime-dogfood` |

## Gates For Slice 25 GitHub Source Runtime

| Gate | Command | 2026-06-29 result |
|---|---|---|
| Focused GitHub/source/ingest tests | `uv run pytest tests/test_github_source_runtime.py tests/test_sources_service.py tests/test_ingest_workflow.py tests/test_architecture.py` | 22 passed |
| Focused lint | `uv run ruff check src/codealmanac/integrations src/codealmanac/services/sources tests/test_github_source_runtime.py tests/test_sources_service.py tests/test_ingest_workflow.py` | passed |
| Full tests | `uv run pytest` | 124 passed |
| Full lint | `uv run ruff check src tests` | passed |
| Diff hygiene | `git diff --check` | passed |
| Package build | `uv build --out-dir /tmp/codealmanac-build-slice25` | passed; wheel includes `integrations/command.py` and `integrations/sources/github/adapter.py` |
| GitHub runtime dogfood | temp Git repo, real `gh` adapter, public `cli/cli` PR #1 and issue #2, fake harness, `app.workflows.ingest.run(...)`, search readback | passed; two available runtime snapshots, prompt contained PR title, issue title, and `diff --git`, search found `github-runtime-dogfood` |

## Gates For Slice 26 Transcript Source Runtime

| Gate | Command | 2026-06-29 result |
|---|---|---|
| Focused transcript runtime tests | `uv run pytest tests/test_transcript_source_runtime.py tests/test_sync_workflow.py tests/test_ingest_workflow.py tests/test_transcript_discovery.py tests/test_architecture.py` | 25 passed |
| Focused lint | `uv run ruff check src/codealmanac/integrations/sources/transcripts src/codealmanac/integrations/sources/__init__.py tests/test_transcript_source_runtime.py tests/test_sync_workflow.py` | passed |
| Full tests | `uv run pytest` | 128 passed |
| Full lint | `uv run ruff check src tests` | passed |
| Diff hygiene | `git diff --check` | passed |
| Package build | `uv build --out-dir /tmp/codealmanac-build-slice26` | passed; wheel includes `integrations/sources/transcripts/runtime.py` and the `jsonlines` dependency |
| Foreground sync transcript runtime dogfood | temp Git repo, JSONL Codex transcript, fake discovery, real `TranscriptSourceRuntimeAdapter`, fake harness, `app.workflows.sync.run(...)`, search readback | passed; prompt contained transcript runtime text, sync started one run, search found `transcript-runtime-dogfood` |

## Gates For Slice 27 Web Source Runtime

| Gate | Command | 2026-06-29 result |
|---|---|---|
| Focused web/source/ingest tests | `uv run pytest tests/test_web_source_runtime.py tests/test_sources_service.py tests/test_ingest_workflow.py tests/test_architecture.py` | 25 passed |
| Focused lint | `uv run ruff check src/codealmanac/integrations/sources tests/test_web_source_runtime.py tests/test_ingest_workflow.py` | passed |
| Full tests | `uv run pytest` | 134 passed |
| Full lint | `uv run ruff check src tests` | passed |
| Diff hygiene | `git diff --check` | passed |
| Package build | `uv build --out-dir /tmp/codealmanac-build-slice27`; wheel inspection | passed; wheel includes `integrations/sources/web/adapter.py` and metadata dependencies for `httpx` and `beautifulsoup4` |
| Web runtime dogfood | temp Git repo, real default `WebSourceRuntimeAdapter`, `https://example.com/`, fake harness, `app.workflows.ingest.run(...)`, search readback | passed; runtime `available`, prompt contained `Example Domain`, search found `web-runtime-dogfood` |

## Gates For Slice 28 Filesystem Source Runtime

| Gate | Command | 2026-06-29 result |
|---|---|---|
| Focused filesystem/source/ingest tests | `uv run pytest tests/test_filesystem_source_runtime.py tests/test_sources_service.py tests/test_ingest_workflow.py tests/test_architecture.py` | 26 passed |
| Focused lint | `uv run ruff check src/codealmanac/integrations/sources tests/test_filesystem_source_runtime.py tests/test_ingest_workflow.py` | passed |
| Full tests | `uv run pytest` | 140 passed |
| Full lint | `uv run ruff check src tests` | passed |
| Diff hygiene | `git diff --check` | passed |
| Package build | `uv build --out-dir /tmp/codealmanac-build-slice28`; wheel inspection | passed; wheel includes `integrations/sources/filesystem/adapter.py` and metadata dependencies for `pathspec` and `charset-normalizer` |
| Filesystem runtime dogfood | temp Git repo, real default filesystem runtime adapter, local `notes.md` and `src/` inputs, fake Codex harness, `app.workflows.ingest.run(...)`, search readback | passed; two available runtime snapshots, prompt contained file and directory text, `.gitignore`d text was absent, search found `filesystem-runtime-dogfood` |

## Gates For Slice 29 Update Command

| Gate | Command | 2026-06-29 result |
|---|---|---|
| Focused update/CLI/architecture tests | `uv run pytest tests/test_update_service.py tests/test_cli.py::test_cli_update_check_json_reports_plan tests/test_cli.py::test_cli_update_refuses_editable_install tests/test_cli.py::test_cli_help_includes_update tests/test_cli.py::test_cli_doctor_reports_local_state tests/test_architecture.py` | 9 passed |
| Focused lint | `uv run ruff check src/codealmanac/services/updates src/codealmanac/integrations/updates src/codealmanac/app.py src/codealmanac/cli/main.py tests/test_update_service.py tests/test_cli.py` | passed |
| Full tests | `uv run pytest` | 147 passed |
| Full lint | `uv run ruff check src tests` | passed |
| Diff hygiene | `git diff --check` | passed |
| Package build | `uv build --out-dir /tmp/codealmanac-build-slice29`; wheel inspection | passed; wheel includes `services/updates/` and `integrations/updates/` modules |
| Live check | `uv run codealmanac update --check` | passed; editable install reported unsupported with `run: git pull && uv sync` |
| Live JSON check | `uv run codealmanac update --check --json` | passed; reported `method: editable`, `installer: uv`, and source URL for this checkout |
| Live default update refusal | `uv run codealmanac update` | passed; exited 1 and refused editable source mutation |

## Gates For Slice 30 Viewer File Route

| Gate | Command | 2026-06-29 result |
|---|---|---|
| Focused viewer/server tests | `uv run pytest tests/test_viewer_service.py tests/test_server.py` | 9 passed |
| Focused lint | `uv run ruff check src/codealmanac/services/viewer src/codealmanac/server tests/test_viewer_service.py tests/test_server.py` | passed |
| Full tests | `uv run pytest` | 150 passed |
| Full lint | `uv run ruff check .` | passed |
| Diff hygiene | `git diff --check` | passed |
| Package build | `uv build --out-dir /tmp/codealmanac-build-slice30`; wheel inspection | passed; wheel includes `server/assets/index.html`, `server/assets/app.js`, and `server/assets/app.css` |
| Live serve API | `uv run codealmanac serve --port 49231`, then curl `/api/file?path=src/viewer/api.ts`, `/api/file?path=src/viewer/`, invalid `../secret.txt`, and `/app.js` | passed; file and folder routes returned matching pages, traversal returned 422, frontend asset contains `renderFile` and `/api/file?path=` |

## Gates For Slice 31 Filesystem Git Directory Listing

| Gate | Command | 2026-06-29 result |
|---|---|---|
| Focused filesystem tests | `uv run pytest tests/test_filesystem_source_runtime.py` | 7 passed |
| Focused source/ingest/architecture tests | `uv run pytest tests/test_filesystem_source_runtime.py tests/test_sources_service.py tests/test_ingest_workflow.py tests/test_architecture.py` | 27 passed |
| Focused lint | `uv run ruff check src/codealmanac/integrations/sources tests/test_filesystem_source_runtime.py tests/test_ingest_workflow.py tests/test_sources_service.py tests/test_architecture.py` | passed |
| Full tests | `uv run pytest` | 151 passed |
| Full lint | `uv run ruff check .` | passed |
| Diff hygiene | `git diff --check` | passed |
| Package build | `uv build --out-dir /tmp/codealmanac-build-slice31`; wheel inspection | passed; wheel includes `integrations/sources/filesystem/adapter.py` and `integrations/command.py` |
| Filesystem Git listing dogfood | temp Git repo with staged tracked file, untracked source file, nested `.gitignore`, `.almanac/`, and `.env`; default `create_app()` source runtime | passed; runtime `available`, `listing_source: git`, included tracked/untracked source text, excluded ignored/private files |

## Gates For Slice 32 Filesystem Directory Selection

| Gate | Command | 2026-06-29 result |
|---|---|---|
| Focused filesystem tests | `uv run pytest tests/test_filesystem_source_runtime.py` | 8 passed |
| Focused source/ingest/architecture tests | `uv run pytest tests/test_filesystem_source_runtime.py tests/test_sources_service.py tests/test_ingest_workflow.py tests/test_architecture.py` | 28 passed |
| Focused lint | `uv run ruff check src/codealmanac/integrations/sources/filesystem tests/test_filesystem_source_runtime.py tests/test_sources_service.py tests/test_ingest_workflow.py tests/test_architecture.py` | passed |
| Full tests | `uv run pytest` | 152 passed |
| Full lint | `uv run ruff check .` | passed |
| Diff hygiene | `git diff --check` | passed |
| Package build | `uv build --out-dir /tmp/codealmanac-build-slice32`; wheel inspection | passed; wheel includes `integrations/sources/filesystem/adapter.py` and `integrations/sources/filesystem/selection.py` |
| Dirty-checkout dogfood | default `create_app()` source runtime inspecting `src/codealmanac/` while slice files were dirty | passed; changed filesystem adapter and selector files ranked before unchanged files |
| Truncation dogfood | temp Git repo with modified tracked file, untracked file, unchanged file, and `max_directory_files=2` | passed; changed files included and unchanged file excluded under the bound |

## Gates For Slice 33 Public Contract Guards

| Gate | Command | 2026-06-29 result |
|---|---|---|
| Focused public contract tests | `uv run pytest tests/test_public_contract.py` | 13 passed |
| Focused CLI/architecture tests | `uv run pytest tests/test_public_contract.py tests/test_cli.py tests/test_architecture.py` | 34 passed |
| Focused lint | `uv run ruff check tests/test_public_contract.py tests/test_cli.py tests/test_architecture.py` | passed |
| Full tests | `uv run pytest` | 165 passed |
| Full lint | `uv run ruff check .` | passed |
| Diff hygiene | `git diff --check` | passed |
| Package build | `uv build --out-dir /tmp/codealmanac-build-slice33`; parsed wheel entry points and package modules | passed; wheel has only the `codealmanac` console script and no `sdk`/`mcp` package modules |
| Live CLI help and forbidden command smoke | `uv run codealmanac --help`; `uv run codealmanac login` | passed; help used `codealmanac`, and `login` failed as an invalid choice |

## Gates For Slice 34 Manual Surface

| Gate | Command | 2026-06-29 result |
|---|---|---|
| Focused manual/build/doctor/prompt tests | `uv run pytest tests/test_manual.py tests/test_build_workflow.py tests/test_diagnostics.py tests/test_cli.py::test_cli_doctor_reports_local_state tests/test_prompts.py` | 14 passed |
| Focused lint | `uv run ruff check src/codealmanac/manual src/codealmanac/app.py src/codealmanac/services/wiki/service.py src/codealmanac/services/diagnostics/service.py tests/test_manual.py tests/test_build_workflow.py tests/test_diagnostics.py tests/test_cli.py` | passed |
| Full tests | `uv run pytest` | 169 passed |
| Full lint | `uv run ruff check .` | passed |
| Diff hygiene | `git diff --check` | passed |
| Package build | `uv build --out-dir /tmp/codealmanac-build-slice34-*`; wheel inspection | passed; wheel includes `codealmanac/manual/*.md`, manual Python modules, prompt Markdown, and the `codealmanac` entry point |
| Live manual dogfood | isolated temp repo and temp `HOME`; `codealmanac build`; `codealmanac doctor --wiki manual-dogfood --json`; delete `pages.md`; repeat doctor | passed; build created `.almanac/manual/README.md` and `ingest.md`, doctor reported `manual: 8 bundled docs` and `manual: 8 docs`, then reported `manual missing: pages.md` with `run: codealmanac build` |

## Gates For Slice 35 Sync Pending Claims

| Gate | Command | 2026-06-29 result |
|---|---|---|
| Focused sync pending tests | `uv run pytest tests/test_sync_workflow.py tests/test_cli.py::test_cli_sync_status_reports_ready_transcripts tests/test_architecture.py` | passed |
| Focused lint | `uv run ruff check src/codealmanac/workflows/sync tests/test_sync_workflow.py` | passed |
| Full tests | `uv run pytest` | 174 passed |
| Full lint | `uv run ruff check .` | passed |
| Diff hygiene | `git diff --check` | passed |
| Live pending dogfood | service-level pending claim observation plus CLI stale/active pending status checks in an isolated temp repo | passed; service observed `pending` before harness write, final ledger was `done`, CLI active pending reported `sync-already-pending`, and CLI stale pending reported `sync-pending-stale` |

## Gates For Slice 36 Run Lifecycle State

| Gate | Command | 2026-06-29 result |
|---|---|---|
| Focused run/lifecycle tests | `uv run pytest tests/test_runs_service.py tests/test_ingest_workflow.py tests/test_garden_workflow.py tests/test_sync_workflow.py` | 30 passed |
| Focused lint | `uv run ruff check src/codealmanac/services/runs src/codealmanac/workflows/ingest src/codealmanac/workflows/garden tests/test_runs_service.py tests/test_ingest_workflow.py tests/test_garden_workflow.py` | passed |
| Full tests | `uv run pytest` | 175 passed |
| Full lint | `uv run ruff check .` | passed |
| Diff hygiene | `git diff --check` | passed |
| Live run lifecycle dogfood | temp repo Ingest through fake harness plus `jobs show`/`jobs logs` readback | passed; `jobs show --json` reported `done` with `started_at` and `finished_at`, and `jobs logs --json` showed `queued ingest`, `running`, `done` |

## Gates For Slice 37 Sync Pending Run Linkage

| Gate | Command | 2026-06-29 result |
|---|---|---|
| Focused sync tests | `uv run pytest tests/test_sync_workflow.py` | 15 passed |
| Focused ingest tests | `uv run pytest tests/test_ingest_workflow.py` | 13 passed |
| Focused lint | `uv run ruff check src/codealmanac/workflows/sync src/codealmanac/workflows/ingest tests/test_sync_workflow.py tests/test_ingest_workflow.py` | passed |
| Full tests | `uv run pytest` | 179 passed |
| Full lint | `uv run ruff check .` | passed |
| Diff hygiene | `git diff --check` | passed |
| Live sync reconciliation dogfood | isolated temp repo with a linked terminal pending run, foreground sync, final ledger readback, and prompt cursor check | passed; CLI status reported `sync-pending-run-done`, foreground sync started a new run at cursor `3-3`, prompt contained `Focus on line 3 onward.`, and final ledger cleared `pending_run_id` |

## Gates For Slice 38 Database Boundary

| Gate | Command | 2026-06-29 result |
|---|---|---|
| Focused database/read-model/architecture tests | `uv run pytest tests/test_database.py tests/test_read_model.py tests/test_architecture.py` | 11 passed |
| Focused lint | `uv run ruff check src/codealmanac/database src/codealmanac/services/index/store.py tests/test_database.py tests/test_architecture.py tests/test_read_model.py` | passed |
| Full tests | `uv run pytest` | 183 passed |
| Full lint | `uv run ruff check .` | passed |
| Diff hygiene | `git diff --check` | passed |
| Live build/search dogfood | isolated temp repo, `codealmanac build`, write page, `codealmanac search`, inspect `index.db` `user_version` and WAL mode | passed; search returned `db-boundary-dogfood`, `user_version=20260630`, `journal_mode=wal`, and the indexed slug existed in `pages` |

## Gates For Slice 39 Config Boundary

| Gate | Command | 2026-06-29 result |
|---|---|---|
| Focused config/CLI/architecture tests | `uv run pytest tests/test_config_service.py tests/test_cli.py::test_cli_ingest_uses_configured_default_harness tests/test_cli.py::test_cli_sync_status_uses_configured_quiet_window tests/test_architecture.py` | 11 passed |
| Focused lint | `uv run ruff check src/codealmanac/services/config src/codealmanac/core src/codealmanac/app.py src/codealmanac/cli/main.py src/codealmanac/services/automation/service.py tests/test_config_service.py tests/test_cli.py tests/test_architecture.py` | passed |
| Full tests | `uv run pytest` | 192 passed |
| Full lint | `uv run ruff check .` | passed |
| Diff hygiene | `git diff --check` | passed |
| Package build | `uv build --out-dir /tmp/codealmanac-build-slice39`; wheel inspection | passed; wheel includes `services/config/` and metadata dependency `pydantic-settings` |
| Live config dogfood | temp repo with `.almanac/config.toml` setting `[sync].quiet = "0s"`, temp `HOME` with one Codex transcript, run `codealmanac sync status --from codex --json` from repo cwd without `--quiet` | passed; scanned 1, eligible 1, ready 1, session `config-dogfood-session` |

## Gates For Slice 40 CLI Edge Split

| Gate | Command | 2026-06-29 result |
|---|---|---|
| Focused CLI/public-contract/architecture tests | `uv run pytest tests/test_architecture.py tests/test_cli.py tests/test_public_contract.py` | 42 passed |
| Focused lint | `uv run ruff check src/codealmanac/cli tests/test_architecture.py tests/test_cli.py tests/test_public_contract.py` | passed |
| Full tests | `uv run pytest` | 195 passed |
| Full lint | `uv run ruff check .` | passed |
| Diff hygiene | `git diff --check` | passed |
| Package build | `uv build --out-dir /tmp/codealmanac-build-slice40`; wheel inspection | passed; wheel includes `cli/main.py`, `cli/parser/`, `cli/dispatch/root.py`, and `cli/render/root.py` |
| Live CLI dogfood | temp repo with `codealmanac build`, committed page, and `codealmanac search` through the installed console script | passed; search returned `cli-split-dogfood` |

## Gates For Slice 41 Configurable Almanac Root

| Gate | Command | 2026-06-29 result |
|---|---|---|
| Focused root/config/sync/lifecycle tests | `uv run pytest tests/test_build_workflow.py tests/test_transcript_discovery.py tests/test_sync_workflow.py tests/test_config_service.py tests/test_cli.py tests/test_runs_service.py tests/test_ingest_workflow.py tests/test_garden_workflow.py` | 75 passed |
| Focused lint | `uv run ruff check src/codealmanac/services/workspaces src/codealmanac/services/config src/codealmanac/workflows src/codealmanac/integrations/sources tests/test_build_workflow.py tests/test_transcript_discovery.py tests/test_sync_workflow.py tests/test_config_service.py tests/test_cli.py tests/test_runs_service.py tests/test_ingest_workflow.py tests/test_garden_workflow.py` | passed |
| Full tests | `uv run pytest` | 204 passed |
| Full lint | `uv run ruff check .` | passed |
| Diff hygiene | `git diff --check` | passed |
| Package build | `uv build --out-dir /tmp/codealmanac-build-slice41` | passed; wheel includes `services/workspaces/roots.py` |
| Live configurable-root dogfood | isolated temp `HOME`; default `codealmanac build`, write/search page under `almanac/`; configured `codealmanac init --root docs/almanac`, plain `codealmanac build`, write/search page under `docs/almanac/`; `codealmanac list` | passed; searches returned `root-dogfood` and `configured-root-dogfood`; plain build reported `built docs-root`; list showed `default-root ... almanac` and `docs-root ... docs/almanac` |

## Gates For Slice 42 Source Runtime Context

| Gate | Command | 2026-06-29 result |
|---|---|---|
| Focused filesystem/source/ingest tests | `uv run pytest tests/test_filesystem_source_runtime.py tests/test_ingest_workflow.py tests/test_sources_service.py` | 36 passed |
| Focused lint | `uv run ruff check src/codealmanac/services/sources/requests.py src/codealmanac/integrations/sources/filesystem/adapter.py src/codealmanac/workflows/ingest/service.py tests/test_filesystem_source_runtime.py tests/test_ingest_workflow.py` | passed |
| Full tests | `uv run pytest` | 213 passed |
| Full lint | `uv run ruff check .` | passed |
| Diff hygiene | `git diff --check` | passed |
| Package build | `uv build --out-dir /tmp/codealmanac-build-slice42`; wheel inspection | passed; wheel includes source request, filesystem runtime, and ingest workflow modules |
| Custom-root dogfood | isolated temp `HOME`; `codealmanac init <repo> --root knowledge`; Git repo with `src/app.py` and `knowledge/pages/runtime-wiki.md`; `app.workflows.ingest.inspect_source_runtime(...)` | passed; runtime included `src/app.py` and excluded `knowledge/pages/runtime-wiki.md` |

## Gates For Slice 43 Scheduled Sync Retry Policy

| Gate | Command | 2026-06-29 result |
|---|---|---|
| Focused sync/automation/CLI tests | `uv run pytest tests/test_sync_workflow.py tests/test_automation_service.py tests/test_cli.py::test_cli_sync_status_reports_ready_transcripts tests/test_cli.py::test_cli_sync_status_uses_retry_budget_flags tests/test_cli.py::test_cli_sync_runs_ingest_for_ready_transcripts tests/test_cli.py::test_cli_automation_install_status_and_uninstall` | 28 passed |
| Focused lint | `uv run ruff check src/codealmanac/workflows/sync src/codealmanac/services/automation src/codealmanac/cli/parser/lifecycle.py src/codealmanac/cli/dispatch/root.py tests/test_sync_workflow.py tests/test_automation_service.py tests/test_cli.py` | passed |
| Full tests | `uv run pytest` | 216 passed |
| Full lint | `uv run ruff check .` | passed |
| Diff hygiene | `git diff --check` | passed |
| Package build | `uv build --out-dir /tmp/codealmanac-build-slice43`; wheel inspection | passed; wheel includes sync workflow, automation service, lifecycle parser, and dispatch modules |
| Retry-budget dogfood | isolated temp `HOME`; synthetic Codex transcript; failed sync ledger with `failed_attempts = 1`; CLI `sync status --from codex --quiet 0s --max-failed-attempts 1 --wiki retry-dogfood` | passed; reported `sync-retry-budget-exhausted` |

## Gates For Slice 44 Clean Directory Diversity

| Gate | Command | 2026-06-29 result |
|---|---|---|
| Focused selector/runtime tests | `uv run pytest tests/test_filesystem_directory_selection.py tests/test_filesystem_source_runtime.py` | 19 passed |
| Focused lint | `uv run ruff check src/codealmanac/integrations/sources/filesystem tests/test_filesystem_directory_selection.py tests/test_filesystem_source_runtime.py` | passed |
| Full tests | `uv run pytest` | 219 passed |
| Full lint | `uv run ruff check .` | passed |
| Diff hygiene | `git diff --check` | passed |
| Package build | `uv build --out-dir /tmp/codealmanac-build-slice44`; wheel inspection | passed; wheel includes filesystem adapter and selector modules |
| Source-runtime dogfood | `app.sources.inspect_runtime(...)` over `src/codealmanac/` | passed; changed filesystem files stayed first and clean service/workflow groups were represented |

## Gates For Slice 45 Viewer Wikilink Token Safety

| Gate | Command | 2026-06-29 result |
|---|---|---|
| Focused viewer renderer/service/server tests | `uv run pytest tests/test_viewer_renderer.py tests/test_viewer_service.py tests/test_server.py` | 11 passed |
| Focused lint | `uv run ruff check src/codealmanac/services/viewer tests/test_viewer_renderer.py tests/test_viewer_service.py tests/test_server.py` | passed |
| Full tests | `uv run pytest` | 221 passed |
| Full lint | `uv run ruff check .` | passed |
| Diff hygiene | `git diff --check` | passed |
| Package build | `uv build --out-dir /tmp/codealmanac-build-slice45`; wheel inspection | passed; wheel includes viewer modules and server adapter |
| Renderer dogfood | `MarkdownRenderer().render(...)` with text, inline-code, fenced-code, and HTML label cases | passed; only text wikilink became an anchor and HTML label was escaped |

## Gates For Slice 46 Serve Visual Port

| Gate | Command | 2026-06-29 result |
|---|---|---|
| Focused viewer/server tests | `uv run pytest tests/test_server.py tests/test_viewer_service.py tests/test_viewer_renderer.py` | 11 passed |
| Focused lint | `uv run ruff check src/codealmanac/services/viewer src/codealmanac/server tests/test_server.py tests/test_viewer_service.py tests/test_viewer_renderer.py` | passed |
| Full tests | `uv run pytest` | 221 passed |
| Full lint | `uv run ruff check .` | passed |
| Diff hygiene | `git diff --check` | passed |
| Package build | `uv build --out-dir /tmp/codealmanac-build-slice46`; wheel inspection | passed; wheel includes updated viewer assets |
| Browser desktop dogfood | temp repo, live `codealmanac serve`, browser-harness page/search/file/wikilink navigation checks | passed; no horizontal overflow, no script nodes in rendered page, side panel file refs visible |
| Browser mobile dogfood | browser-harness at 390px width on page route | passed; page rendered, side panel collapsed, search fit viewport, no horizontal overflow |

## Gates For Slice 47 Viewer Frontend Modules

| Gate | Command | 2026-06-29 result |
|---|---|---|
| Focused server/viewer tests | `uv run pytest tests/test_server.py tests/test_viewer_service.py tests/test_viewer_renderer.py` | 12 passed |
| Focused server lint | `uv run ruff check src/codealmanac/server tests/test_server.py` | passed |
| Full tests | `uv run pytest` | 222 passed |
| Full lint | `uv run ruff check .` | passed |
| Diff hygiene | `git diff --check` | passed |
| Package build | `uv build --out-dir /tmp/codealmanac-build-slice47`; wheel inspection | passed; wheel includes `server/assets/viewer/*.js` |
| Static asset contract | `tests/test_server.py` | covers nested module serving, missing asset 404, traversal validation, unsupported extension validation, and module script tag |
| Browser module dogfood | temp repo, live `codealmanac serve`, browser-harness page/search/file/wikilink navigation and module fetch checks | passed; `/app.js`, `/assets/viewer/main.js`, and `/assets/viewer/api.js` loaded as JavaScript |

## Gates For Slice-47 Review Fix

| Gate | Command | 2026-06-29 result |
|---|---|---|
| Focused server/viewer tests | `uv run pytest tests/test_server.py tests/test_viewer_service.py tests/test_viewer_renderer.py` | 12 passed |
| Focused server lint | `uv run ruff check src/codealmanac/server tests/test_server.py` | passed |
| Diff hygiene | `git diff --check` | passed |
| Browser malformed-hash dogfood | temp repo, live `codealmanac serve`, browser-harness route to `#/page/%` | passed; viewer rendered the error state instead of breaking module execution |
| Package build | `uv build --out-dir /tmp/codealmanac-build-slice47-final`; wheel inspection | passed; wheel includes updated nested viewer modules |

## Gates For Slice 48 Update Install Dogfood

| Gate | Command | 2026-06-29 result |
|---|---|---|
| Focused update tests | `uv run pytest tests/test_update_service.py tests/test_cli.py::test_cli_update_check_json_reports_plan tests/test_cli.py::test_cli_update_refuses_editable_install tests/test_cli.py::test_cli_help_includes_update` | 8 passed |
| Focused update lint | `uv run ruff check src/codealmanac/services/updates src/codealmanac/integrations/updates src/codealmanac/cli/dispatch/root.py tests/test_update_service.py tests/test_cli.py` | passed |
| Pip install dogfood | throwaway Python 3.12 venv, `python -m pip install <wheel>`, `codealmanac update --check --json`, `PIP_NO_INDEX=1 PIP_FIND_LINKS=<wheel-dir> codealmanac update --json` | passed; metadata reported `installer: pip`, planned venv-local Python, and update returned `status: completed` |
| Uv-tool install dogfood | throwaway `UV_TOOL_DIR` and `UV_TOOL_BIN_DIR`, `uv tool install <wheel>`, `codealmanac update --check --json`, `UV_FIND_LINKS=<wheel-dir> codealmanac update --json` | passed; metadata reported `installer: uv`, planned `uv tool upgrade codealmanac`, and update returned `status: completed` with `Nothing to upgrade` on stderr |
| Full tests | `uv run pytest` | 223 passed |
| Full lint | `uv run ruff check .` | passed |
| Diff hygiene | `git diff --check` | passed |
| Package build | `uv build --wheel --no-build-logs --out-dir /tmp/codealmanac-build-slice48-final` | passed; wheel built as `codealmanac-0.1.0-py3-none-any.whl` |

## Gates For Slice 49 CLI Admin Edge Split

| Gate | Command | 2026-06-29 result |
|---|---|---|
| Focused architecture/admin CLI tests | `uv run pytest tests/test_architecture.py tests/test_cli.py::test_cli_help_includes_update tests/test_cli.py::test_cli_update_check_json_reports_plan tests/test_cli.py::test_cli_update_refuses_editable_install tests/test_cli.py::test_cli_automation_install_status_and_uninstall tests/test_cli.py::test_cli_jobs_inspects_local_run_records tests/test_cli.py::test_cli_doctor_json_reports_no_wiki` | 15 passed |
| Focused CLI lint | `uv run ruff check src/codealmanac/cli tests/test_architecture.py tests/test_cli.py` | passed |
| Admin CLI dogfood | `uv run codealmanac update --check --json`; `uv run codealmanac doctor --json`; `uv run codealmanac automation status --json`; `uv run codealmanac jobs --json --limit 1`; `uv run codealmanac --help` | passed; editable update reported unsupported as expected, doctor reached diagnostics, automation returned launchd status, jobs returned `[]`, and help listed admin commands |
| Full tests | `uv run pytest` | 224 passed |
| Full lint | `uv run ruff check .` | passed |
| Diff hygiene | `git diff --check` | passed |
| Package build | `uv build --wheel --no-build-logs --out-dir /tmp/codealmanac-build-slice49-final`; wheel inspection | passed; wheel includes `cli/dispatch/admin.py`, `cli/dispatch/config.py`, and `cli/render/admin.py` |

## Gates For Slice 50 Index Read Views

| Gate | Command | 2026-06-29 result |
|---|---|---|
| Focused read-view tests | `uv run pytest tests/test_architecture.py tests/test_read_model.py tests/test_topics_health.py tests/test_viewer_service.py tests/test_cli.py::test_cli_search_and_show_read_current_repo_wiki tests/test_cli.py::test_cli_topics_and_health_read_current_repo_wiki tests/test_cli.py::test_cli_build_and_reindex_commands` | 27 passed |
| Focused index lint | `uv run ruff check src/codealmanac/services/index tests/test_architecture.py tests/test_read_model.py tests/test_topics_health.py tests/test_viewer_service.py tests/test_cli.py` | passed |
| Temp-repo read dogfood | isolated temp `HOME`; initialized a wiki; ran `search`, `search --mentions`, `show --backlinks`, `topics --wiki cqrs-dogfood show auth`, and `health` | passed; search/mentions/backlinks returned `auth-flow`, topic listed both pages, and health was clean |
| Full tests | `uv run pytest` | 225 passed |
| Full lint | `uv run ruff check .` | passed |
| Diff hygiene | `git diff --check` | passed |
| Package build | `uv build --wheel --no-build-logs --out-dir /tmp/codealmanac-build-slice50-final`; wheel inspection | passed; wheel includes `services/index/views.py` |

## Gates For Slice 51 Serve Shell Polish

| Gate | Command | 2026-06-29 result |
|---|---|---|
| Focused serve/static tests | `uv run pytest tests/test_server.py tests/test_architecture.py -q` | 16 passed |
| Static/API serve dogfood | isolated temp `HOME`; temp wiki; `uv --project /Users/rohan/Desktop/Projects/codealmanac run codealmanac serve --host 127.0.0.1 --port 49233`; `curl /`, `/assets/viewer/main.js`, `/api/overview`, `/api/page/auth-flow` | passed; returned CodeAlmanac viewer shell, route-state JS, and expected wiki payloads |
| Full tests | `uv run pytest` | 226 passed |
| Full lint | `uv run ruff check .` | passed |
| Diff hygiene | `git diff --check` | passed |
| Package build | `uv build --wheel --no-build-logs --out-dir /tmp/codealmanac-build-slice51-final`; wheel inspection | passed; wheel includes updated viewer assets, no `clamp(` or `vw`, `repo-owned wiki`, and `dataset.railKind` |
| Browser-harness visual dogfood | isolated temporary Chrome profile with explicit `BU_CDP_URL`; live temp `serve`; overview/page/topic/search route checks; 390px mobile page route check | passed; sidebar-first shell rendered, page/topic/search active states were correct, file refs were visible, dense mobile rail and side panel collapsed, search fit viewport, and no horizontal overflow appeared |

## Gates For Slice 52 Manual Drift Diagnostics

| Gate | Command | 2026-06-29 result |
|---|---|---|
| Focused manual/doctor/CLI tests | `uv run pytest tests/test_manual.py tests/test_diagnostics.py tests/test_cli.py::test_cli_doctor_reports_manual_drift -q` | 9 passed |
| Focused manual/doctor lint | `uv run ruff check src/codealmanac/manual src/codealmanac/services/diagnostics tests/test_manual.py tests/test_diagnostics.py tests/test_cli.py` | passed |
| Full tests | `uv run pytest` | 229 passed |
| Full lint | `uv run ruff check .` | passed |
| Diff hygiene | `git diff --check` | passed |
| Package build | `uv build --wheel --no-build-logs --out-dir /tmp/codealmanac-build-slice52`; wheel inspection | passed; wheel includes manual library/model modules and bundled manual Markdown |
| Manual drift dogfood | isolated temp `HOME`; temp repo; `codealmanac build`; edit `almanac/manual/README.md`; `codealmanac doctor --wiki manual-drift-dogfood --json` | passed; `wiki.manual` reported `status: "info"`, `manual differs: README.md`, and a review-only fix message |

## Gates For Slice 53 Registry List Management

| Gate | Command | 2026-06-29 result |
|---|---|---|
| Focused workspace/CLI tests | `uv run pytest tests/test_build_workflow.py::test_workspace_registry_reports_and_drops_missing_wikis tests/test_build_workflow.py::test_workspace_registry_drops_selected_wiki tests/test_cli.py::test_cli_list_json_reports_registry_status tests/test_cli.py::test_cli_list_drop_removes_selected_wiki tests/test_cli.py::test_cli_list_drop_missing_removes_unreachable_wikis -q` | 5 passed |
| Focused workspace/CLI lint | `uv run ruff check src/codealmanac/services/workspaces src/codealmanac/cli tests/test_build_workflow.py tests/test_cli.py` | passed |
| Source-runtime dogfood | `uv run python` service-level inspection of `src/codealmanac/`, `src/codealmanac/services/sources/`, and `src/codealmanac/integrations/sources/filesystem/` | passed; Git listing used changed-then-diverse selection and did not justify recency/ranking changes |
| Full tests | `uv run pytest` | 234 passed |
| Full lint | `uv run ruff check .` | passed |
| Diff hygiene | `git diff --check` | passed |
| Package build | `uv build --wheel --no-build-logs --out-dir /tmp/codealmanac-build-slice53`; wheel inspection | passed; wheel includes changed workspace service and CLI parser/render modules |
| Registry cleanup dogfood | isolated temp `HOME`; temp live and missing repos; `codealmanac list --json`; `codealmanac list --drop-missing`; `codealmanac list`; `codealmanac list --drop drop-me` | passed; JSON reported `available` and `missing_repo`, drop-missing removed only the unreachable entry, selected drop removed the named entry |

## Gates For Slice 54 Harness Failure Logs

| Gate | Command | 2026-06-29 result |
|---|---|---|
| Focused workflow tests | `uv run pytest tests/test_ingest_workflow.py tests/test_garden_workflow.py` | 17 passed |
| Focused lifecycle lint | `uv run ruff check src/codealmanac/workflows/lifecycle.py src/codealmanac/workflows/ingest/service.py src/codealmanac/workflows/garden/service.py tests/test_ingest_workflow.py tests/test_garden_workflow.py` | passed |
| Full tests | `uv run pytest` | 235 passed |
| Full lint | `uv run ruff check .` | passed |
| Diff hygiene | `git diff --check` | passed |
| Package build | `uv build --wheel --no-build-logs --out-dir /tmp/codealmanac-build-slice54`; wheel inspection | passed; wheel includes lifecycle, ingest workflow, and garden workflow modules |
| Failed-harness log dogfood | isolated temp `HOME`; temp Git repo; fake Codex harness returned failed and mutated `src/app.py`; `codealmanac jobs logs <run-id>` | passed; log reported `output codex failed...`, then safety `error`, then `status failed` |

## Gates For Slice 55 Normalized Harness Events

| Gate | Command | 2026-06-29 result |
|---|---|---|
| Focused harness/workflow tests | `uv run pytest tests/test_harnesses_service.py tests/test_codex_adapter.py tests/test_claude_adapter.py tests/test_ingest_workflow.py tests/test_garden_workflow.py` | 35 passed |
| Focused harness/workflow lint | `uv run ruff check src/codealmanac/services/harnesses src/codealmanac/integrations/harnesses src/codealmanac/workflows tests/test_harnesses_service.py tests/test_codex_adapter.py tests/test_claude_adapter.py tests/test_ingest_workflow.py tests/test_garden_workflow.py` | passed |
| Full tests | `uv run pytest` | 236 passed |
| Full lint | `uv run ruff check .` | passed |
| Diff hygiene | `git diff --check` | passed |
| Package build | `uv build --wheel --no-build-logs --out-dir /tmp/codealmanac-build-slice55`; wheel inspection | passed; wheel includes harness models, Codex/Claude adapters, lifecycle helpers, and ingest/garden workflows |
| Normalized harness event dogfood | isolated temp `HOME`; temp Git repo; fake Codex harness returned text/tool/tool/done events; `codealmanac jobs logs <run-id>` | passed; log reported output/tool/tool/output events before `status done` |

## Gates For Slice 56 Public Release README

| Gate | Command | 2026-06-29 result |
|---|---|---|
| Focused public-contract tests | `uv run pytest tests/test_public_contract.py` | 15 passed |
| Focused public-contract lint | `uv run ruff check tests/test_public_contract.py` | passed |
| Full tests | `uv run pytest` | 238 passed |
| Full lint | `uv run ruff check .` | passed |
| Diff hygiene | `git diff --check` | passed |
| Package build | `uv build --wheel --no-build-logs --out-dir /tmp/codealmanac-build-slice56`; wheel metadata/package-data inspection | passed; README metadata, license file, server assets, manual files, and prompts present |
| Clean wheel install dogfood | isolated temp venv and `HOME`; install built wheel; installed `codealmanac --help`, `init`, `search`, `show`, `health --json`, `jobs`, and `serve` `/api/overview` | passed; temp repo initialized, search found `getting-started`, viewer returned workspace `repo` with one page |

## Gates For Slice 57 Real Codex Ingest Dogfood

| Gate | Command | 2026-06-29 result |
|---|---|---|
| First real Codex ingest dogfood | service-level temp repo, temp registry, real `CodexCliHarnessAdapter`, source `notes/auth-boundary.md` | passed mechanically; created `almanac/pages/auth-billing-boundary.md`, preserved non-wiki files, and recorded jobs log output, but health reported broken `workos` and `autumn` page links |
| Prompt/manual link contract tests | `uv run pytest tests/test_prompts.py tests/test_manual.py tests/test_ingest_workflow.py::test_ingest_workflow_resolves_sources_runs_harness_and_refreshes_index` | 8 passed |
| Second real Codex ingest dogfood | service-level temp repo after prompt/manual fix, real `CodexCliHarnessAdapter`, same source shape | passed; created `almanac/pages/auth-membership-boundary.md`, `search auth` returned the page, jobs log recorded provider output, and health had no broken links |
| Starter health guard | `uv run pytest tests/test_build_workflow.py::test_initialize_starter_wiki_has_no_health_noise tests/test_build_workflow.py::test_initialize_creates_almanac_wiki_and_registry tests/test_prompts.py tests/test_manual.py tests/test_ingest_workflow.py::test_ingest_workflow_resolves_sources_runs_harness_and_refreshes_index` | 10 passed |
| Full tests | `uv run pytest` | 239 passed |
| Full lint | `uv run ruff check .` | passed |
| Diff hygiene | `git diff --check` | passed |

## Gates For Slice 58 Real Claude Ingest Dogfood

| Gate | Command | 2026-06-29 result |
|---|---|---|
| Claude readiness | `claude auth status` | passed; logged in with first-party Claude auth |
| Real Claude ingest dogfood | service-level temp repo, temp registry, real `ClaudeCliHarnessAdapter`, source `notes/incident-window.md` | passed; created `almanac/pages/incident-window-policy.md`, updated `almanac/topics.yaml`, preserved non-wiki files, and recorded jobs log output |
| Public CLI readback | `codealmanac jobs logs ingest-20260629230850-d1048550`; `codealmanac search deploy`; `codealmanac show incident-window-policy`; `codealmanac health --json` | passed; logs were readable, search returned the page, show rendered the page, and health was clean |
| Cosmic note relay | `doppler run --project almanac --config dev -- relayforge reply ... --binding rohan-almanac-main` | passed; sent the service-layer/composition-root dogfood note to Discord |

## Gates For Slice 59 Real Sync Dogfood

| Gate | Command | 2026-06-29 result |
|---|---|---|
| Initial sync status | service-level temp repo, temp registry, temp Codex transcript home, `RunSyncStatusRequest(..., apps=(codex,), quiet=0s)` | passed; scanned 1 transcript and reported `sync-dogfood-codex-session` ready for lines 1-3 |
| Real sync run | `RunSyncRequest(..., apps=(codex,), harness=claude, claim_owner="real-sync-dogfood")` | passed; started `ingest-20260629231810-40e74df3`, created `almanac/pages/sync-workflow.md`, and advanced `sync-ledger.json` to `done` with line 3 and byte 962 absorbed |
| Repeat skip proof | second `RunSyncStatusRequest(..., apps=(codex,), quiet=0s)` | passed; scanned 1 transcript, eligible 0, skipped 1 with reason `unchanged` |
| Health proof | `app.health.check(...)` and public `codealmanac health --json` | passed; no broken links, dead refs, empty topics, or empty pages |
| Public CLI readback | `uv run --project /Users/rohan/Desktop/Projects/codealmanac codealmanac sync status --from codex --quiet 0s`; `jobs logs`; `jobs show --json`; `search sync`; `show sync-workflow --lead`; `health --json` | passed; branch-selected CLI saw the skipped transcript, readable job log, readable job record, searchable page, and clean health |

## Gates For Slice 60 Serve Browser Proof

| Gate | Command | 2026-06-29 result |
|---|---|---|
| Temp wiki preflight | temp `HOME`; `codealmanac build`; `codealmanac health --json`; `codealmanac search auth` | passed; health was clean and search returned `auth-flow` plus `billing-boundary` |
| Live server | `HOME=/tmp/codealmanac-serve-slice60-Dxi7UN/home uv run --project /Users/rohan/Desktop/Projects/codealmanac codealmanac serve --host 127.0.0.1 --port 49260` | passed; `/api/overview` returned 3 pages and 3 topics |
| Browser desktop routes | isolated Chrome profile with `BU_CDP_URL=http://127.0.0.1:9224`; browser-harness route assertions for `/`, `#/page/auth-flow`, `#/topic/auth`, `#/search/auth`, and `#/file/src/auth/session.py` | passed; all expected headings/content rendered and every route had `scrollWidth <= clientWidth` |
| Browser mobile route | browser-harness `390x844` viewport on `#/page/auth-flow` | passed; page content and file refs rendered with `scrollWidth == clientWidth == 390` |
| Cleanup | stopped local server and isolated Chrome session | passed |

## Gates For Slice 61 Final Package Rehearsal

| Gate | Command | 2026-06-29 result |
|---|---|---|
| Package build | `uv build --out-dir /tmp/codealmanac-release-slice61` | passed; built `codealmanac-0.1.0-py3-none-any.whl` and `codealmanac-0.1.0.tar.gz` |
| Metadata/package-data inspection | stdlib `zipfile`/`tarfile` inspection of built artifacts | passed; README, Apache-2.0 license metadata, license file, console script, server assets, manual files, and prompts were present |
| Python version guard | clean install attempt under Python 3.11.10 | passed; install failed because package requires `>=3.12` |
| Clean wheel install | Python 3.12.9 venv install from built wheel | passed; installed `codealmanac --help` rendered the CLI |
| Clean sdist install | Python 3.12.9 venv install from built sdist | passed; installed `codealmanac --help` rendered the CLI |
| Installed CLI smoke | both clean installs ran `init`, `search`, `show`, `topics`, `health --json`, `jobs`, `sync status`, `doctor --json`, and live `serve` HTTP checks | passed; final output was `wheel-install: ok` and `sdist-install: ok` |

## Gates For Slice 62 Python Release Guide

| Gate | Command | 2026-06-29 result |
|---|---|---|
| Public contract tests | `uv run pytest tests/test_public_contract.py` | passed; release guide and package metadata guards included |
| Package metadata build | `uv build --out-dir /tmp/codealmanac-release-slice62` | passed; built wheel and sdist after removing the superseded license classifier |
| Twine metadata check | `uvx twine check /tmp/codealmanac-release-slice62/*` | passed for wheel and sdist |
| Wheel metadata inspection | stdlib `zipfile`/`email.parser` over built wheel metadata | passed; author, SPDX license expression, license file, repository/issues URLs, and classifiers present |
| Full tests | `uv run pytest` | 240 passed |
| Full lint | `uv run ruff check .` | passed |
| Diff hygiene | `git diff --check` | passed |

## Gates For Slice 63 Missing Root Hygiene

| Gate | Command | 2026-06-30 result |
|---|---|---|
| Targeted missing-root repros | `uv run pytest tests/test_diagnostics.py::test_doctor_does_not_materialize_missing_registered_wiki tests/test_build_workflow.py::test_workspace_registry_reports_and_drops_missing_wikis tests/test_read_model.py::test_search_does_not_materialize_missing_registered_wiki -q` | passed; 3 tests first failed against the old behavior and pass after the marker-based root guard |
| Adjacent read/diagnostic/build tests | `uv run pytest tests/test_diagnostics.py tests/test_read_model.py tests/test_build_workflow.py tests/test_cli.py::test_cli_doctor_json_reports_no_wiki tests/test_cli.py::test_cli_list_json_reports_registry_status tests/test_cli.py::test_cli_list_drop_missing_removes_unreachable_wikis -q` | 27 passed |
| Live missing-root dogfood | isolated temp `HOME`; `codealmanac init`; delete `repo/almanac`; `codealmanac doctor --wiki repo --json`; `codealmanac list --json` | passed; doctor reported `wiki.registered` problem with `run: codealmanac build`, list reported `missing_almanac`, and `repo/almanac` was not recreated |
| Cosmic note relay | `doppler run --project almanac --config dev -- relayforge reply --config ../relayforge/relay.config.json --binding rohan-almanac-main ...` | passed; sent the Chapter 6 Unit of Work note and why this slice used marker validation instead of adding UoW |
| Full tests | `uv run pytest` | 242 passed |
| Full lint | `uv run ruff check .` | passed |
| Diff hygiene | `git diff --check` | passed |

## Gates For Slice 64 README Scaffold Accuracy

| Gate | Command | 2026-06-30 result |
|---|---|---|
| Public contract tests | `uv run pytest tests/test_public_contract.py -q` | 17 passed; README init scaffold section is guarded separately from runtime state |
| Init scaffold dogfood | isolated temp `HOME`; temp repo; `codealmanac init <repo> --name readme-tree`; `find <repo> -maxdepth 3` | passed; init created `.gitignore`, `almanac/README.md`, `topics.yaml`, `pages/getting-started.md`, and manual docs, not `config.toml`, `jobs/`, or `index.db` |
| Cosmic note relay | `doppler run --project almanac --config dev -- relayforge reply --config ../relayforge/relay.config.json --binding rohan-almanac-main ...` | passed; sent the Chapter 2 Repository-pattern note and how it maps to source wiki artifact vs runtime storage |
| Full tests | `uv run pytest` | 243 passed |
| Full lint | `uv run ruff check .` | passed |
| Diff hygiene | `git diff --check` | passed |

## Gates For Slice 65 README Quickstart Dogfood

| Gate | Command | 2026-06-30 result |
|---|---|---|
| Quickstart mismatch repro | isolated temp `HOME`; temp repo; `codealmanac init`; `codealmanac search "auth"`; `codealmanac search "getting"`; `codealmanac show getting-started --lead` | passed; `search "auth"` returned `# 0 results`, while `search "getting"` returned `getting-started` and `show --lead` rendered `# Getting Started` |
| Public contract tests | `uv run pytest tests/test_public_contract.py -q` | 18 passed; quickstart section now guards `search "getting"` and rejects `search "auth"` |
| Fixed quickstart dogfood | isolated temp `HOME`; temp repo; `codealmanac init`; `codealmanac search "getting"`; `codealmanac show getting-started --lead` | passed; search returned `getting-started` and show rendered `# Getting Started` |
| Cosmic note relay | `doppler run --project almanac --config dev -- relayforge reply --config ../relayforge/relay.config.json --binding rohan-almanac-main ...` | passed; sent the Chapter 4 Service Layer note and how it maps to README quickstart as a public use case |
| Full tests | `uv run pytest` | 244 passed |
| Full lint | `uv run ruff check .` | passed |
| Diff hygiene | `git diff --check` | passed |

## Gates For Slice 66 README Lifecycle Source Examples

| Gate | Command | 2026-06-30 result |
|---|---|---|
| README example parser/source check | `uv run python` using `build_parser()` for lifecycle examples and `SourcesService.resolve(...)` for `README.md` plus `github:pr:123` | passed; examples parse, `README.md` resolves as `path.file`, and `github:pr:123` resolves as `github.pull_request` |
| Public contract tests | `uv run pytest tests/test_public_contract.py -q` | 19 passed |
| Cosmic note relay | `doppler run --project almanac --config dev -- relayforge reply --config ../relayforge/relay.config.json --binding rohan-almanac-main ...` | passed; sent the Chapter 3 abstraction note and how it maps to testing README source examples through `SourcesService` |
| Full tests | `uv run pytest` | 245 passed |
| Full lint | `uv run ruff check .` | passed |
| Diff hygiene | `git diff --check` | passed |

## Gates For Slice 67 Next Agent Brief Freshness

| Gate | Command | 2026-06-30 result |
|---|---|---|
| Continuation contract test | `uv run pytest tests/test_public_contract.py::test_next_agent_brief_tracks_latest_python_port_slice -q` | 1 passed |
| Public contract tests | `uv run pytest tests/test_public_contract.py -q` | 20 passed |
| Focused lint | `uv run ruff check tests/test_public_contract.py` | passed |
| Cosmic note relay | `doppler run --project almanac --config dev -- relayforge reply --config ../relayforge/relay.config.json --binding rohan-almanac-main ...` | passed; sent the Chapter 4 service-layer testing note and how it maps to the next-agent brief contract |
| Full tests | `uv run pytest` | 246 passed |
| Full lint | `uv run ruff check .` | passed |
| Diff hygiene | `git diff --check` | passed |

## Gates For Slice 68 Public Beta Gate Audit

| Gate | Command | 2026-06-30 result |
|---|---|---|
| Audit coverage contract | `uv run pytest tests/test_public_contract.py::test_public_beta_gate_audit_covers_release_gate_areas -q` | 1 passed |
| Public contract tests | `uv run pytest tests/test_public_contract.py -q` | 21 passed |
| Focused lint | `uv run ruff check tests/test_public_contract.py` | passed |
| Cosmic note relay | `doppler run --project almanac --config dev -- relayforge reply --config ../relayforge/relay.config.json --binding rohan-almanac-main ...` | passed; sent the Chapter 10 commands-vs-events note and how it maps to public beta gate audit coverage |
| Full tests | `uv run pytest` | 247 passed |
| Full lint | `uv run ruff check .` | passed |
| Diff hygiene | `git diff --check` | passed |

## Gates For Slice 69 Current Head Package Rehearsal

| Gate | Command | 2026-06-30 result |
|---|---|---|
| Package build | `uv build --out-dir /tmp/codealmanac-release-slice69` | passed; built `codealmanac-0.1.0-py3-none-any.whl` and `codealmanac-0.1.0.tar.gz` |
| Twine metadata check | `uvx twine check /tmp/codealmanac-release-slice69/*` | passed for wheel and sdist |
| Metadata/package-data inspection | stdlib `zipfile`/`tarfile`/`email.parser` inspection of built artifacts | passed; README, Apache-2.0 license metadata, license file, server assets, viewer modules, manual docs, and prompt docs present |
| Clean wheel install | `uv venv --python 3.12 /tmp/codealmanac-wheel-slice69` then `uv pip install --python ... codealmanac-0.1.0-py3-none-any.whl` | passed; installed into CPython 3.12.9 environment |
| Clean sdist install | `uv venv --python 3.12 /tmp/codealmanac-sdist-slice69` then `uv pip install --python ... codealmanac-0.1.0.tar.gz` | passed; built and installed into CPython 3.12.9 environment |
| Installed CLI smoke | wheel and sdist venvs ran `--help`, `init`, `search getting`, `show getting-started --lead`, `topics`, `health --json`, `jobs`, `sync status --from codex --quiet 0s`, `doctor --json`, and live `serve` HTTP checks for `/api/overview` plus `/app.js` | passed |
| Installed update check | wheel and sdist venvs ran `codealmanac update --check --json` | passed; reported non-editable uv-package update plans |
| Public audit guard | `uv run pytest tests/test_public_contract.py -q` | 22 passed |
| Focused lint | `uv run ruff check tests/test_public_contract.py` | passed |
| Cosmic note relay | `doppler run --project almanac --config dev -- relayforge reply --config ../relayforge/relay.config.json --binding rohan-almanac-main ...` | passed; sent the project-structure packaging note and current-head package rehearsal commands |
| Full tests | `uv run pytest` | 248 passed |
| Full lint | `uv run ruff check .` | passed |
| Diff hygiene | `git diff --check` | passed |

## Gates For Slice 70 Real Source Shape Dogfood

| Gate | Command | 2026-06-30 result |
|---|---|---|
| Non-toy lifecycle dogfood | real `codealmanac ingest` with Claude against `/tmp/codealmanac-lifecycle-dogfood-slice70-real`, using CodeAlmanac source-runtime, filesystem adapter, ingest workflow, prompt, and live-agreement inputs | passed; created `almanac/pages/source-runtime-flow.md`, reported run `ingest-20260630004924-1039ba82: done`, and changed one wiki page |
| Dogfood health/readback | `codealmanac health --json`, `codealmanac jobs logs ingest-20260630004924-1039ba82`, `codealmanac show source-runtime-flow` | passed; health clean, logs readable, page covered source layers, service ownership, filesystem runtime selection, ingest prompt consumption, and gotchas |
| User-state path focused tests | `uv run pytest tests/test_public_contract.py::test_default_user_state_paths_are_product_specific tests/test_cli.py::test_cli_init_creates_wiki_and_prints_name tests/test_config_service.py tests/test_automation_service.py::test_automation_install_plans_sync_and_garden -q` | passed; 8 tests |
| Cosmic note relay | `doppler run --project almanac --config dev -- relayforge reply --config ../relayforge/relay.config.json --binding rohan-almanac-main ...` | passed in three messages after a single too-large Discord 400 response |
| Public contract tests | `uv run pytest tests/test_public_contract.py -q` | passed; 23 tests |
| Full tests | `uv run pytest` | passed; 249 tests |
| Full lint | `uv run ruff check .` | passed |
| Diff hygiene | `git diff --check` | passed |

## Gates For Slice 71 Current Head Package Smoke

| Gate | Command | 2026-06-30 result |
|---|---|---|
| Package build | `uv build --out-dir /tmp/codealmanac-release-slice71` | passed; built `codealmanac-0.1.0-py3-none-any.whl` and `codealmanac-0.1.0.tar.gz` |
| Twine metadata check | `uvx twine check /tmp/codealmanac-release-slice71/*` | passed for wheel and sdist |
| Metadata/package-data inspection | stdlib `zipfile`/`tarfile`/`email.parser` inspection of built artifacts | passed; no missing files; license `Apache-2.0`; `Requires-Python >=3.12`; wheel README metadata includes `~/.codealmanac/` |
| Clean wheel install | `uv venv --python 3.12 /tmp/codealmanac-wheel-slice71` then `uv pip install --python ... codealmanac-0.1.0-py3-none-any.whl` | passed; installed into CPython 3.12.9 environment |
| Clean sdist install | `uv venv --python 3.12 /tmp/codealmanac-sdist-slice71` then `uv pip install --python ... codealmanac-0.1.0.tar.gz` | passed; built and installed into CPython 3.12.9 environment |
| Installed CLI smoke | wheel and sdist venvs ran `--help`, `init`, `search getting`, `show getting-started --lead`, `topics`, `health --json`, `jobs`, `sync status --from codex --quiet 0s`, `doctor --json`, `update --check --json`, and live `serve` HTTP checks for `/api/overview` plus `/assets/viewer/main.js` | passed |
| State path proof | installed `init` with temp `HOME` for wheel and sdist | passed; `.codealmanac/registry.json` exists and `.almanac/registry.json` is absent in both temp homes |
| Public contract tests | `uv run pytest tests/test_public_contract.py -q` | passed; 23 tests |
| Full tests | `uv run pytest` | passed; 249 tests |
| Full lint | `uv run ruff check .` | passed |
| Diff hygiene | `git diff --check` | passed |
