# Coverage Map

## Scan Summary

CodeAlmanac is a Python 3.12 CLI and local service graph for maintaining a repo-owned Markdown wiki. The public command is `codealmanac`; the package entrypoint creates the app composition root, parses CLI arguments, dispatches to services or workflows, and renders text or JSON.

The runtime shape is service/workflow/integration architecture. Services own product nouns and persistence contracts, workflows own multi-service product verbs, integrations own subprocess, HTTP, Git, filesystem, scheduler, and agent-provider mechanics, and `src/codealmanac/app.py` wires the graph.

The product has two overlapping operating modes:

- Repo-local wiki reads and lifecycle writes: `init`, `dev ingest`, `dev garden`, `sync`, `jobs`, `search`, `show`, `topics`, `health`, `serve`.
- Cloud/local control-plane work: cloud login/repo/runs/capture surfaces, plus local setup, local triggers, detached worker workspaces, engine runs, and Git delivery.

The wiki source is flat under the configured Almanac root: `README.md`, `topics.yaml`, `pages/`, and `manual/`. Derived state is local SQLite or JSON/JSONL state under the configured root or `~/.codealmanac/`.

## Evidence Scanned

Primary project guidance:

- `AGENTS.md` instructions supplied in the session.
- `MANUAL.md`.
- `README.md`.
- `CONTRIBUTING.md`.
- `RELEASE.md`.
- `pyproject.toml`.
- `docs/python-port-live-agreement.md`.
- `docs/python-port/next-agent-brief.md`.
- `docs/python-port/public-release-readiness.md`.
- `docs/python-port/public-beta-gate-audit.md`.
- `docs/concepts.md`.
- `docs/plans/2026-07-02-slice-*.md` index.
- `docs/python-port/slice-*.md` index.
- `docs/reference/cosmic-python/chapter_02_repository.md`.
- `docs/reference/cosmic-python/chapter_04_service_layer.md`.
- `docs/reference/cosmic-python/chapter_06_uow.md`.
- `docs/reference/cosmic-python/chapter_10_commands.md`.
- `docs/reference/cosmic-python/chapter_13_dependency_injection.md`.

Almanac root and manual:

- `eval-almanac/README.md`.
- `eval-almanac/topics.yaml`.
- `eval-almanac/manual/README.md`.
- `eval-almanac/manual/how-to-write.md`.
- `eval-almanac/manual/evidence.md`.
- `eval-almanac/manual/links.md`.
- `eval-almanac/manual/concepts.md`.
- `eval-almanac/manual/architecture.md`.
- `eval-almanac/manual/how-to-guides.md`.
- `eval-almanac/manual/decisions.md`.
- `eval-almanac/manual/reference.md`.

Entrypoints and composition:

- `src/codealmanac/app.py`.
- `src/codealmanac/cli/main.py`.
- `src/codealmanac/cli/parser/*.py`.
- `src/codealmanac/cli/dispatch/*.py`.
- `src/codealmanac/cli/render/*.py`.
- `src/codealmanac/server/*.py`.
- `src/codealmanac/server/assets/index.html`.
- `src/codealmanac/server/assets/app.css`.
- `src/codealmanac/server/assets/viewer/*.js`.

Core and persistence:

- `src/codealmanac/core/models.py`.
- `src/codealmanac/core/errors.py`.
- `src/codealmanac/core/paths.py`.
- `src/codealmanac/core/slug.py`.
- `src/codealmanac/database/sqlite.py`.
- `src/codealmanac/services/index/schema.py`.
- `src/codealmanac/services/index/store.py`.
- `src/codealmanac/services/index/sources.py`.
- `src/codealmanac/services/index/projection.py`.
- `src/codealmanac/services/index/*_views.py`.
- `src/codealmanac/services/control/schema.py`.
- `src/codealmanac/services/control/store.py`.
- `src/codealmanac/services/runs/*.py`.
- `src/codealmanac/workflows/sync/store.py`.

Wiki and read model services:

- `src/codealmanac/services/wiki/*.py`.
- `src/codealmanac/services/search/*.py`.
- `src/codealmanac/services/pages/*.py`.
- `src/codealmanac/services/topics/*.py`.
- `src/codealmanac/services/health/*.py`.
- `src/codealmanac/services/tagging/*.py`.
- `src/codealmanac/services/viewer/*.py`.

Source, prompt, and manual material:

- `src/codealmanac/services/sources/*.py`.
- `src/codealmanac/integrations/sources/filesystem/*.py`.
- `src/codealmanac/integrations/sources/git/*.py`.
- `src/codealmanac/integrations/sources/github/*.py`.
- `src/codealmanac/integrations/sources/transcripts/*.py`.
- `src/codealmanac/integrations/sources/web/*.py`.
- `src/codealmanac/prompts/base/kernel.md`.
- `src/codealmanac/prompts/operations/init.md`.
- `src/codealmanac/prompts/operations/coverage-map.md`.
- `src/codealmanac/prompts/operations/ingest.md`.
- `src/codealmanac/prompts/operations/garden.md`.
- `src/codealmanac/prompts/operations/update.md`.
- `src/codealmanac/prompts/renderer.py`.
- `src/codealmanac/manual/*.md`.
- `src/codealmanac/manual/library.py`.

Harnesses and lifecycle workflows:

- `src/codealmanac/services/harnesses/*.py`.
- `src/codealmanac/integrations/harnesses/codex/*.py`.
- `src/codealmanac/integrations/harnesses/claude/*.py`.
- `src/codealmanac/workflows/init/*.py`.
- `src/codealmanac/workflows/ingest/*.py`.
- `src/codealmanac/workflows/garden/*.py`.
- `src/codealmanac/workflows/page_run/*.py`.
- `src/codealmanac/workflows/run_queue/*.py`.
- `src/codealmanac/workflows/sync/*.py`.

Local and cloud control plane:

- `src/codealmanac/services/control/*.py`.
- `src/codealmanac/services/local_hooks/*.py`.
- `src/codealmanac/services/source_bundles/*.py`.
- `src/codealmanac/services/engine_runs/*.py`.
- `src/codealmanac/services/deliveries/*.py`.
- `src/codealmanac/services/worker_workspaces/*.py`.
- `src/codealmanac/workflows/local_setup/*.py`.
- `src/codealmanac/workflows/local_status/*.py`.
- `src/codealmanac/workflows/local_policy/*.py`.
- `src/codealmanac/workflows/local_update/*.py`.
- `src/codealmanac/workflows/local_runs/*.py`.
- `src/codealmanac/workflows/local_engine/*.py`.
- `src/codealmanac/workflows/local_delivery/*.py`.
- `src/codealmanac/workflows/local_worker/*.py`.
- `src/codealmanac/integrations/workspaces/git/*.py`.
- `src/codealmanac/integrations/runs/*.py`.
- `src/codealmanac/services/cloud_auth/*.py`.
- `src/codealmanac/services/cloud_capture/*.py`.
- `src/codealmanac/services/cloud_repositories/*.py`.
- `src/codealmanac/services/cloud_runs/*.py`.
- `src/codealmanac/workflows/cloud_login/*.py`.
- `src/codealmanac/workflows/cloud_repo/*.py`.
- `src/codealmanac/workflows/cloud_runs/*.py`.
- `src/codealmanac/workflows/cloud_open/*.py`.
- `src/codealmanac/integrations/cloud/http.py`.
- `src/codealmanac/integrations/capture/*.py`.

Setup, automation, diagnostics, config, update:

- `src/codealmanac/services/setup/*.py`.
- `src/codealmanac/integrations/setup/*.py`.
- `src/codealmanac/services/automation/*.py`.
- `src/codealmanac/integrations/automation/scheduler/launchd.py`.
- `src/codealmanac/services/diagnostics/*.py`.
- `src/codealmanac/services/config/*.py`.
- `src/codealmanac/services/updates/*.py`.
- `src/codealmanac/integrations/updates/package.py`.

Test contracts:

- `tests/test_architecture.py`.
- `tests/test_public_contract.py`.
- `tests/test_cli.py`.
- `tests/test_init_workflow.py`.
- `tests/test_ingest_workflow.py`.
- `tests/test_garden_workflow.py`.
- `tests/test_run_queue_workflow.py`.
- `tests/test_sync_workflow.py`.
- `tests/test_runs_service.py`.
- `tests/test_read_model.py`.
- `tests/test_wiki_parsing.py`.
- `tests/test_topics_mutation.py`.
- `tests/test_topics_health.py`.
- `tests/test_sources_service.py`.
- `tests/test_filesystem_source_runtime.py`.
- `tests/test_filesystem_directory_selection.py`.
- `tests/test_git_local_repository_probe.py`.
- `tests/test_github_source_runtime.py`.
- `tests/test_transcript_source_runtime.py`.
- `tests/test_web_source_runtime.py`.
- `tests/test_codex_app_server_adapter.py`.
- `tests/test_claude_adapter.py`.
- `tests/test_harnesses_service.py`.
- `tests/test_local_setup_workflow.py`.
- `tests/test_local_update_workflow.py`.
- `tests/test_local_run_preparation_workflow.py`.
- `tests/test_local_engine_workflow.py`.
- `tests/test_local_delivery_workflow.py`.
- `tests/test_local_worker_workflow.py`.
- `tests/test_local_hooks.py`.
- `tests/test_control_service.py`.
- `tests/test_engine_runs_service.py`.
- `tests/test_source_bundles_service.py`.
- `tests/test_worker_workspaces_service.py`.
- `tests/test_deliveries_service.py`.
- `tests/test_cloud_auth_service.py`.
- `tests/test_cloud_repo_workflow.py`.
- `tests/test_cloud_runs_workflow.py`.
- `tests/test_capture_transcript_upload.py`.
- `tests/test_automation_service.py`.
- `tests/test_setup_service.py`.
- `tests/test_diagnostics.py`.
- `tests/test_server.py`.
- `tests/test_viewer_service.py`.
- `tests/test_viewer_renderer.py`.
- `tests/test_config_service.py`.
- `tests/test_update_service.py`.
- `tests/test_manual.py`.
- `tests/test_prompts.py`.

Archived reference scanned at directory level only:

- `archive/code/src/cli/commands/`.
- `archive/code/src/wiki/`.
- `archive/code/src/agent/`.
- `archive/code/prompts/`.
- `archive/code/guides/`.
- `archive/code/test/`.

## Subject Map

- Product identity: Python package, public `codealmanac` command, local alpha status, `~/.codealmanac/` user state, configurable repo roots.
- Architecture boundary: CLI is an adapter, app is composition root, services own nouns, workflows own verbs, integrations own external mechanics.
- Wiki source format: Markdown pages, YAML frontmatter, structured `sources:`, `files:`, unified `[[...]]` links, flat configured root.
- Index read model: derived SQLite `index.db`, FTS5 search, page/topic/file/source/link projections, health categories, `GLOB` path matching.
- Workspace selection: nearest initialized wiki roots, conventional roots, registry JSON, explicit drops, path containment validation.
- Lifecycle writes: `init`, `ingest`, `garden`, shared page-run safety, prompt rendering, harness invocation, mutation validation, index refresh.
- Background jobs: run records, specs, logs, worker locks, foreground/background execution, attach/cancel behavior.
- Sync: transcript discovery, quiet windows, per-wiki ledger, pending claims, foreground/background ingest execution.
- Source inputs: address resolution for paths, Git ranges/diffs, GitHub PR/issues, URLs, transcript paths; runtime adapters render prompt material.
- Harnesses: service-owned normalized contract, Codex app-server adapter, Claude Agent SDK adapter, normalized event stream.
- Local control plane: control SQLite schema, Git local setup, trigger events, detached worker workspaces, source bundles, engine run artifacts, delivery.
- Cloud control plane: login polling, auth token store, cloud repo trigger policy, cloud runs, capture hooks and transcript upload.
- Setup and automation: managed agent instruction blocks, Claude import files, Codex AGENTS blocks, launchd scheduled sync/garden.
- Viewer/server: FastAPI API routes, static package-data UI, markdown-it renderer, hash routes, jobs polling.
- Operational gates: `uv run pytest`, `uv run ruff check .`, package release checks, public contract tests.

## Page Inventory

### Root

- `getting-started`: Front door for the wiki and navigation by task. Evidence: `README.md`, `src/codealmanac/app.py`, this map. Links: all major architecture and guide pages.

### `concepts/`

- `concepts-repo-owned-wiki`: Defines the durable repo-local Markdown wiki model and what belongs in it. Evidence: `README.md`, `MANUAL.md`, `eval-almanac/README.md`, `src/codealmanac/services/wiki/service.py`. Links: `wiki-file-format-reference`, `workspace-registry-and-root-resolution`.
- `concepts-configured-almanac-root`: Explains configured roots, marker files, and why code must use `Workspace.almanac_path`. Evidence: `docs/python-port-live-agreement.md`, `src/codealmanac/services/workspaces/roots.py`, `src/codealmanac/services/workspaces/models.py`. Links: `workspace-registry-and-root-resolution`, `user-and-repo-state-paths-reference`.
- `concepts-lifecycle-operation`: Defines lifecycle operations as the only AI-backed page-writing surface. Evidence: `MANUAL.md`, `docs/python-port-live-agreement.md`, `src/codealmanac/workflows/init/service.py`, `src/codealmanac/workflows/ingest/service.py`, `src/codealmanac/workflows/garden/service.py`. Links: `lifecycle-page-run-workflow`, `init-ingest-garden-workflows`.
- `concepts-source-material`: Defines source addresses, source briefs, source runtimes, and prompt material. Evidence: `src/codealmanac/services/sources/models.py`, `src/codealmanac/services/sources/address_resolution.py`, `src/codealmanac/workflows/ingest/service.py`. Links: `source-resolution-and-runtimes`, `source-address-syntax-reference`.
- `concepts-normalized-harness-event`: Defines the provider-neutral event stream used in run logs. Evidence: `src/codealmanac/services/harnesses/events.py`, `src/codealmanac/services/runs/models.py`, `docs/python-port-live-agreement.md`. Links: `harness-service-contract`, `harness-event-contract-reference`.
- `concepts-local-control-plane`: Defines the newer local branch/run/update control plane separate from repo-local lifecycle jobs. Evidence: `src/codealmanac/services/control/schema.py`, `src/codealmanac/workflows/local_worker/service.py`, `README.md`. Links: `local-control-db`, `local-trigger-to-delivery-flow`.
- `concepts-page-provenance`: Explains page `sources:` and citations as indexed page model data. Evidence: `src/codealmanac/services/wiki/frontmatter.py`, `src/codealmanac/services/index/schema.py`, `docs/python-port-live-agreement.md`. Links: `wiki-file-format-reference`, `index-schema-reference`.

### `architecture/`

- `app-composition-root`: Documents how `create_app()` wires services, workflows, and integrations. Evidence: `src/codealmanac/app.py`, `tests/test_architecture.py`. Links: `services-workflows-integrations-boundary`, `cli-adapter-boundary`.
- `cli-adapter-boundary`: Explains parser/dispatch/render split and command-family facades. Evidence: `src/codealmanac/cli/main.py`, `src/codealmanac/cli/parser/*.py`, `src/codealmanac/cli/dispatch/*.py`, `src/codealmanac/cli/render/*.py`, `docs/python-port-live-agreement.md`. Links: `cli-command-surface-reference`, `app-composition-root`.
- `workspace-registry-and-root-resolution`: Covers registry JSON, nearest root discovery, conventional roots, and no auto-prune rule. Evidence: `src/codealmanac/services/workspaces/*.py`, `tests/test_workspace_registry_store.py`, `tests/test_public_contract.py`. Links: `concepts-configured-almanac-root`, `user-and-repo-state-paths-reference`.
- `wiki-page-model-and-link-parser`: Covers page loading, frontmatter parsing, slug derivation, wikilink classification, and file refs. Evidence: `src/codealmanac/services/wiki/documents.py`, `frontmatter.py`, `wikilinks.py`, `paths.py`, `tests/test_wiki_parsing.py`. Links: `wiki-file-format-reference`, `wikilink-syntax-reference`.
- `sqlite-index-read-model`: Covers derived index refresh, schema ownership, source signatures, projection, and read views. Evidence: `src/codealmanac/services/index/*.py`, `tests/test_read_model.py`, `tests/test_architecture.py`. Links: `index-schema-reference`, `search-show-health-flow`.
- `search-show-health-flow`: Covers `search`, `show`, `topics`, `health`, `reindex`, tagging, and how read commands refresh derived state. Evidence: `src/codealmanac/services/search/service.py`, `pages/service.py`, `health/service.py`, `tagging/service.py`, `cli/dispatch/wiki.py`. Links: `sqlite-index-read-model`, `topics-dag-and-mutations`.
- `topics-dag-and-mutations`: Covers topic YAML, DAG mutation safeguards, frontmatter rewrites, and topic read models. Evidence: `src/codealmanac/services/topics/*.py`, `src/codealmanac/services/wiki/topic_*.py`, `tests/test_topics_mutation.py`, `tests/test_topics_health.py`. Links: `wiki-file-format-reference`, `search-show-health-flow`.
- `source-resolution-and-runtimes`: Covers `SourceAddress -> SourceRef -> SourceBrief -> SourceRuntime` and adapter dispatch. Evidence: `src/codealmanac/services/sources/*.py`, `src/codealmanac/integrations/sources/__init__.py`. Links: `concepts-source-material`, `source-address-syntax-reference`.
- `filesystem-source-runtime`: Covers file/directory prompt material, Git-aware directory listing, ignore rules, bounds, and selection ranking. Evidence: `src/codealmanac/integrations/sources/filesystem/*.py`, `tests/test_filesystem_source_runtime.py`, `tests/test_filesystem_directory_selection.py`. Links: `source-resolution-and-runtimes`.
- `git-and-github-source-runtimes`: Covers Git diff/range material and GitHub CLI PR/issue material. Evidence: `src/codealmanac/integrations/sources/git/adapter.py`, `src/codealmanac/integrations/sources/github/*.py`, `tests/test_github_source_runtime.py`. Links: `source-resolution-and-runtimes`.
- `transcript-source-runtime`: Covers Claude/Codex transcript discovery and runtime rendering. Evidence: `src/codealmanac/integrations/sources/transcripts/*.py`, `tests/test_transcript_discovery.py`, `tests/test_transcript_source_runtime.py`. Links: `sync-workflow-and-ledger`, `source-resolution-and-runtimes`.
- `web-source-runtime`: Covers bounded HTTP fetch, content classification, HTML text extraction, and rendering. Evidence: `src/codealmanac/integrations/sources/web/*.py`, `tests/test_web_source_runtime.py`. Links: `source-resolution-and-runtimes`.
- `lifecycle-page-run-workflow`: Covers shared lifecycle run begin/preflight/harness/event/safety/index/finish path. Evidence: `src/codealmanac/workflows/page_run/service.py`, `src/codealmanac/workflows/lifecycle*.py`, `tests/test_ingest_workflow.py`, `tests/test_garden_workflow.py`. Links: `concepts-lifecycle-operation`, `run-ledger-and-job-queue`.
- `init-ingest-garden-workflows`: Covers operation-specific preparation and prompt rendering for init, ingest, and garden. Evidence: `src/codealmanac/workflows/init/service.py`, `ingest/service.py`, `garden/service.py`, `src/codealmanac/prompts/operations/*.md`. Links: `lifecycle-page-run-workflow`, `prompt-and-manual-resources`.
- `run-ledger-and-job-queue`: Covers run records, specs, logs, locks, queue draining, attach, cancel, and foreground/background behavior. Evidence: `src/codealmanac/services/runs/*.py`, `src/codealmanac/workflows/run_queue/service.py`, `tests/test_runs_service.py`, `tests/test_run_queue_workflow.py`. Links: `run-ledger-files-reference`, `sync-workflow-and-ledger`.
- `sync-workflow-and-ledger`: Covers transcript discovery, quiet-window evaluation, pending ledger claims, foreground/background ingest, and terminal reconciliation. Evidence: `src/codealmanac/workflows/sync/*.py`, `tests/test_sync_workflow.py`. Links: `transcript-source-runtime`, `sync-ledger-format-reference`.
- `harness-service-contract`: Covers provider readiness, harness run selection, normalized result, events, and default adapters. Evidence: `src/codealmanac/services/harnesses/*.py`, `src/codealmanac/integrations/harnesses/__init__.py`, `tests/test_harnesses_service.py`. Links: `codex-app-server-harness`, `claude-sdk-harness`.
- `codex-app-server-harness`: Covers Codex app-server JSON-RPC lifecycle, sandboxing, noninteractive responses, event mapping, and helper agents. Evidence: `src/codealmanac/integrations/harnesses/codex/*.py`, `tests/test_codex_app_server_adapter.py`. Links: `harness-service-contract`, `harness-event-contract-reference`.
- `claude-sdk-harness`: Covers Claude Agent SDK lifecycle, options, auth readiness, typed message mapping, and helper agents. Evidence: `src/codealmanac/integrations/harnesses/claude/*.py`, `tests/test_claude_adapter.py`. Links: `harness-service-contract`, `harness-event-contract-reference`.
- `prompt-and-manual-resources`: Covers package-resource prompts/manuals and how lifecycle prompts combine base kernel, operation prompt, and runtime JSON. Evidence: `src/codealmanac/prompts/*.py`, `src/codealmanac/manual/*.py`, `src/codealmanac/workflows/*/service.py`, `tests/test_manual.py`, `tests/test_prompts.py`. Links: `prompts-manuals-as-package-resources`.
- `local-control-db`: Covers repositories, branches, sessions, turns, triggers, runs, events, and deliveries in `control.sqlite`. Evidence: `src/codealmanac/services/control/schema.py`, `store.py`, `models.py`, `tests/test_control_service.py`. Links: `control-db-schema-reference`, `concepts-local-control-plane`.
- `local-trigger-to-delivery-flow`: Covers local setup, Git hooks, manual update, trigger claim, worker, engine, and delivery flow. Evidence: `src/codealmanac/workflows/local_*/service.py`, `src/codealmanac/integrations/workspaces/git/*.py`, `tests/test_local_*`. Links: `local-control-db`, `local-worker-artifact-flow`.
- `local-worker-artifact-flow`: Covers detached workspaces, source bundles, engine request/result files, and delivery patch collection. Evidence: `src/codealmanac/services/worker_workspaces/*.py`, `source_bundles/*.py`, `engine_runs/*.py`, `integrations/workspaces/git/worktree.py`. Links: `local-trigger-to-delivery-flow`.
- `setup-instruction-installers`: Covers setup/uninstall planning and managed instruction writes for Codex and Claude. Evidence: `src/codealmanac/services/setup/*.py`, `src/codealmanac/integrations/setup/*.py`, `tests/test_setup_service.py`. Links: `setup-managed-blocks-reference`, `automation-launchd`.
- `automation-launchd`: Covers scheduled sync/garden task selection, job construction, plist writes, and launchctl interaction. Evidence: `src/codealmanac/services/automation/*.py`, `src/codealmanac/integrations/automation/scheduler/launchd.py`, `tests/test_automation_service.py`. Links: `setup-instruction-installers`.
- `cloud-cli-workflows`: Covers login/whoami/logout, cloud repo status/triggers, cloud runs, and cloud open handoff. Evidence: `src/codealmanac/services/cloud_*.py`, `src/codealmanac/workflows/cloud_*.py`, `src/codealmanac/integrations/cloud/http.py`, cloud tests. Links: `cloud-http-contract-reference`, `cli-command-surface-reference`.
- `capture-hooks-and-upload`: Covers Codex/Claude capture hooks, transcript normalization, routing, credential state, and upload event store. Evidence: `src/codealmanac/services/cloud_capture/*.py`, `src/codealmanac/integrations/capture/*.py`, `tests/test_capture_transcript_upload.py`. Links: `cloud-cli-workflows`, `transcript-source-runtime`.
- `viewer-server-and-static-ui`: Covers FastAPI routes, viewer DTOs, markdown rendering, static ES module UI, hash routing, and job polling. Evidence: `src/codealmanac/server/*.py`, `src/codealmanac/services/viewer/*.py`, `src/codealmanac/server/assets/viewer/*.js`, viewer/server tests. Links: `search-show-health-flow`.
- `config-diagnostics-and-updates`: Covers config precedence, doctor checks, package update command, and release-facing install checks. Evidence: `src/codealmanac/services/config/*.py`, `diagnostics/*.py`, `updates/*.py`, `integrations/updates/package.py`, tests. Links: `user-and-repo-state-paths-reference`, `release-and-test-gates-reference`.

### `decisions/`

- `python-local-rewrite-decision`: Records the Python rewrite as the active codebase and archive behavior as reference. Evidence: `README.md`, `docs/python-port-live-agreement.md`, `archive/code/`. Links: `app-composition-root`.
- `codealmanac-public-surface-decision`: Records public command/state naming and intentionally dropped aliases/surfaces. Evidence: `docs/python-port-live-agreement.md`, `pyproject.toml`, `tests/test_public_contract.py`, `README.md`. Links: `cli-command-surface-reference`.
- `services-workflows-integrations-boundary`: Records the boundary rule enforced by architecture tests. Evidence: `MANUAL.md`, `docs/python-port-live-agreement.md`, `tests/test_architecture.py`, `src/codealmanac/app.py`. Links: `app-composition-root`.
- `prompts-manuals-as-package-resources`: Records why prompts/manuals are package files, not Python string literals. Evidence: `docs/python-port-live-agreement.md`, `pyproject.toml`, `src/codealmanac/prompts/`, `src/codealmanac/manual/`. Links: `prompt-and-manual-resources`.
- `no-page-archive-lineage-decision`: Records removal of archive/supersede page lineage from the Python model. Evidence: `docs/python-port-live-agreement.md`, `src/codealmanac/services/wiki/models.py`, `src/codealmanac/services/index/schema.py`. Links: `wiki-page-model-and-link-parser`.
- `static-viewer-no-build-step-decision`: Records why the viewer is static package-data ES modules for now. Evidence: `docs/python-port-live-agreement.md`, `src/codealmanac/server/assets/`, `pyproject.toml`. Links: `viewer-server-and-static-ui`.
- `source-address-layering-decision`: Records the four-layer source-input model. Evidence: `docs/python-port-live-agreement.md`, `src/codealmanac/services/sources/models.py`, source adapters. Links: `source-resolution-and-runtimes`.
- `background-jobs-user-state-decision`: Records per-wiki/background job state and user-level job path. Evidence: `docs/python-port-live-agreement.md`, `src/codealmanac/services/runs/*.py`, `src/codealmanac/core/paths.py`. Links: `run-ledger-and-job-queue`.

### `reference/`

- `cli-command-surface-reference`: Exact public and hidden command families and major flags. Evidence: `src/codealmanac/cli/parser/*.py`, `README.md`, `tests/test_public_contract.py`. Links: `cli-adapter-boundary`.
- `user-and-repo-state-paths-reference`: Exact repo source files and user/global runtime state paths. Evidence: `README.md`, `src/codealmanac/core/paths.py`, `src/codealmanac/services/workspaces/roots.py`, `src/codealmanac/services/runs/service.py`. Links: `workspace-registry-and-root-resolution`.
- `wiki-file-format-reference`: Exact frontmatter fields, source fields, page ID/title/summary/topic/file behavior. Evidence: `src/codealmanac/services/wiki/frontmatter.py`, `documents.py`, manuals. Links: `concepts-page-provenance`.
- `wikilink-syntax-reference`: Exact `[[...]]` classification rules and path normalization behavior. Evidence: `src/codealmanac/services/wiki/wikilinks.py`, `src/codealmanac/services/wiki/paths.py`, tests. Links: `wiki-page-model-and-link-parser`.
- `index-schema-reference`: Exact derived SQLite index tables and health categories. Evidence: `src/codealmanac/services/index/schema.py`, `models.py`. Links: `sqlite-index-read-model`.
- `control-db-schema-reference`: Exact `control.sqlite` tables and enums. Evidence: `src/codealmanac/services/control/schema.py`, `models.py`. Links: `local-control-db`.
- `run-ledger-files-reference`: Exact run record/spec/log/lock path and model contract. Evidence: `src/codealmanac/services/runs/models.py`, `paths.py`, `io.py`. Links: `run-ledger-and-job-queue`.
- `sync-ledger-format-reference`: Exact sync ledger schema, status values, cursor fields, and storage path. Evidence: `src/codealmanac/workflows/sync/models.py`, `store.py`. Links: `sync-workflow-and-ledger`.
- `source-address-syntax-reference`: Exact source address syntaxes and source kind mapping. Evidence: `src/codealmanac/services/sources/address_*.py`, `models.py`. Links: `source-resolution-and-runtimes`.
- `harness-event-contract-reference`: Exact event kinds, tool display kinds, status values, and run result fields. Evidence: `src/codealmanac/services/harnesses/events.py`, `results.py`, `kinds.py`, `actors.py`. Links: `harness-service-contract`.
- `cloud-http-contract-reference`: Exact HTTP client endpoints and response mapping families. Evidence: `src/codealmanac/integrations/cloud/http.py`, cloud service models. Links: `cloud-cli-workflows`.
- `setup-managed-blocks-reference`: Exact managed block markers and instruction target file behavior. Evidence: `src/codealmanac/integrations/setup/*.py`, `src/codealmanac/services/setup/agent-guide.md`. Links: `setup-instruction-installers`.
- `release-and-test-gates-reference`: Exact quality gates, package build checks, and public-contract assertions. Evidence: `CONTRIBUTING.md`, `RELEASE.md`, `pyproject.toml`, `tests/test_public_contract.py`. Links: `config-diagnostics-and-updates`.

### `guides/`

- `add-a-lifecycle-operation-guide`: Procedure for adding a page-writing operation without bypassing page-run safety. Evidence: `src/codealmanac/workflows/init/`, `ingest/`, `garden/`, `page_run/`, CLI dispatch patterns. Links: `lifecycle-page-run-workflow`.
- `add-a-source-runtime-guide`: Procedure for adding a source kind or runtime adapter. Evidence: `src/codealmanac/services/sources/`, `src/codealmanac/integrations/sources/`, tests. Links: `source-resolution-and-runtimes`.
- `add-a-harness-adapter-guide`: Procedure for adding a provider behind the harness contract. Evidence: `src/codealmanac/services/harnesses/`, `src/codealmanac/integrations/harnesses/`, harness tests. Links: `harness-service-contract`.
- `change-the-index-guide`: Procedure for changing page parsing, projection, schema, or health/read views. Evidence: `src/codealmanac/services/wiki/`, `src/codealmanac/services/index/`, tests. Links: `sqlite-index-read-model`.
- `work-on-local-update-flow-guide`: Procedure for modifying local triggers, worker preparation, engine runs, or delivery safely. Evidence: `src/codealmanac/workflows/local_*`, `src/codealmanac/services/control/`, local tests. Links: `local-trigger-to-delivery-flow`.
- `run-quality-gates-guide`: Procedure for the repo's standard validation commands and tests to run by risk area. Evidence: `CONTRIBUTING.md`, `pyproject.toml`, tests. Links: `release-and-test-gates-reference`.

## Dropped Or Deferred

- `archive/code/` TypeScript implementation pages: deferred because the active rewrite uses it only as behavior reference, and active Python pages can link to the decision that explains that.
- Hosted frontend/dashboard docs under `docs/codealmanac-launch/` and `docs/hosted-local-live-agreement/`: deferred as product-strategy/archive material. The active source tree now includes cloud CLI workflows, so the wiki covers implemented cloud code instead.
- Individual slice plan pages: deferred because the live agreement and tests capture current durable decisions; slice files are evidence, not separate wiki subjects.
- `maintenance/` module: deferred because it is a small service surface with less evidence than the cloud/local lifecycle flows; it can be added later if maintenance API work resumes.
- `build/` workflow directory: deferred because Python v1 intentionally has no public `codealmanac build` command and the directory has no active service files.
- Per-renderer CLI pages: compressed into `cli-adapter-boundary` and `cli-command-surface-reference` because render modules answer one shared boundary question.

## Coverage Audit

The map covers product identity, public CLI surface, composition, service/workflow/integration boundaries, wiki source format, index schema, workspace resolution, lifecycle workflows, background jobs, sync, source runtimes, harnesses, local control plane, cloud control plane, setup, automation, viewer, config, diagnostics, update, release gates, and tests that enforce architecture.

The main risk is breadth: the repo contains both local-only rewrite decisions and newer cloud/local control-plane implementation. The inventory keeps both because current source and tests contain both. The decision pages should make clear which surfaces are product direction and which are implemented cloud support.

The most compressed areas are cloud HTTP response mapping and local delivery details. They are represented as one architecture page plus one reference page because their code is straightforward and already strongly typed.

No planned page is a placeholder. Every planned page has source evidence and a future-agent search reason.
