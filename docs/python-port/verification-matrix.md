# Python Port Verification Matrix

Updated: 2026-06-29

This matrix tracks evidence for the full active goal. Empty or weak evidence
means the goal remains active.

| Requirement | Implementation evidence | Test/live evidence | Remaining risk |
|---|---|---|---|
| Fresh Python codebase | `pyproject.toml`, `src/codealmanac/`, `tests/` | `uv run pytest`, `uv run ruff check .` passed on 2026-06-29 | Remaining risks are background sync owner/retry policy, clean-directory semantic ranking, and visual browser verification. |
| Based on live agreement | `docs/python-port-live-agreement.md`, `src/codealmanac/app.py`, service/workflow packages | tests exercise CLI -> app -> services/workflows over local `.almanac/` | Need future architecture tests as more services appear. |
| Cosmic Python actively considered | `docs/reference/cosmic-python/`, `docs/python-port/`, composition root, service-layer tests, store boundary, Git snapshot policy for lifecycle writes | tests call workflow/service and CLI surfaces instead of private helpers; Relayforge Discord checkpoints sent | Need continued review before public lifecycle CLI. |
| CLI exists as `codealmanac` only | `[project.scripts] codealmanac = "codealmanac.cli.main:main"` plus argparse commands | `uv run codealmanac --help`, live `init`, `build`, `ingest`, `garden`, foreground `sync`, `sync status`, `list`, `search`, `show`, `topics create/describe/link/unlink/rename/delete`, `reindex`, `doctor`, `serve`, `automation status`, and `update --check` passed on 2026-06-29 | Non-editable package-manager update dogfood remains pending. |
| SQLite-backed wiki/index behavior | `services/index`, `services/wiki`, `services/search`, `services/pages` | parser/index/search/show tests, stale-schema regression, stale-aware refresh regression, isolated live smoke, dogfood search | `refresh` still parses source markdown to compute signatures; optimize only after real large-repo pressure. |
| Workflows: build, ingest, sync, garden | `workflows/build`; `workflows/ingest`; `workflows/garden`; `workflows/sync`; `services/runs`; `services/sources`; `services/harnesses`; `LifecycleMutationPolicy`; public `codealmanac ingest`, `codealmanac garden`, foreground `codealmanac sync`, and read-only `codealmanac sync status` | build tests; runs service/jobs CLI tests; sources service tests; transcript discovery tests; source-resolution dogfood; harness service tests; sync status and foreground sync tests; ingest/garden workflow safety tests; harness transcript feedback tests; sync internal-exclusion tests; sync pending-claim tests; run lifecycle state tests; pending run-linkage tests; real Claude and Codex CLI ingest dogfood; real Codex Garden dogfood; synthetic transcript sync dogfood | Background sync owner/retry policy remains pending after foreground pending run reconciliation. |
| Integrations behind service ports | ownership map drafted; filesystem, Git, GitHub, transcript, and web runtime adapters implement `SourceRuntimeAdapter`; transcript discovery adapters implement `TranscriptDiscoveryAdapter`; Claude and Codex CLI implement `HarnessAdapter`; Git workspace change probe implements `WorkspaceChangeProbe`; architecture test guards import direction | sources, source runtime, transcript discovery, harness, Claude/Codex adapter, Git probe, ingest safety, sync status, sync run, and architecture tests; real Claude and Codex ingest dogfood; real filesystem/Git/GitHub/transcript/web runtime dogfood | Source runtime MVP is covered; remaining risk is semantic diversity or recency ranking for clean large directories. |
| Prompts/manual surfaces | `src/codealmanac/prompts/` package resources, `PromptRenderer`, `src/codealmanac/manual/` package resources, `.almanac/manual/` build materialization, and doctor manual checks | prompt/manual tests; build and diagnostics tests; ingest and garden workflow prompt assertions; wheel inspection confirmed prompt and manual Markdown packaged; isolated live build/doctor dogfood passed | Prompt and manual quality need continued lifecycle dogfood review. |
| Tests and live verification | pytest/ruff configured in `pyproject.toml` | `uv run pytest`, `uv run ruff check .`, `uv run codealmanac --help`, live temp `init`/`list`/`search`/`show`, dogfood search, dogfood serve API passed | Browser-harness visual verification is still blocked: `browser-harness --doctor` on 2026-06-29 reported Chrome running but daemon/browser connections unavailable until Chrome remote debugging is allowed. |
| Frequent review | slice-1 review fix hardened registry temp writes and typed selector helpers | `uv run pytest`, `uv run ruff check .`, live temp `init`/`list` passed after review fix | Need the same checkpoint discipline after each meaningful slice. |
| No hosted CLI/MCP/SDK/aliases | live agreement records exclusion; `tests/test_public_contract.py` guards entry points, forbidden commands, and package module names | `uv run pytest tests/test_public_contract.py` passed on 2026-06-29; full `uv run pytest` and `uv run ruff check .` passed on 2026-06-29 | Future CLI expansion must keep the public-contract guard current. |

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
