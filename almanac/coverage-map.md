---
title: Coverage Map
topics: [wiki-build]
sources:
  - id: repo-readme
    type: file
    path: README.md
    note: Public product and command overview.
  - id: live-agreement
    type: file
    path: docs/python-port-live-agreement.md
    note: Current Python rewrite decisions.
  - id: manual
    type: file
    path: MANUAL.md
    note: Repo engineering rules and local product constraints.
---

# Coverage Map

This file is the frozen page inventory for the first useful CodeAlmanac wiki in this repository. It is working state for the build run, not an article. The inventory is grounded in the public README, the active Python rewrite agreement, and the repo manual [@repo-readme] [@live-agreement] [@manual].

## Page Inventory

### Root Pages

- path: `almanac/README.md`
  - slug: `README`
  - purpose: Introduce the finished wiki and route readers to the main clusters.
  - planned links: `getting-started`, `concepts/local-repo-wiki`, `architecture/service-boundaries`, `reference/cli/public-command-surface`
  - key evidence: `README.md`, `almanac/README.md`, `docs/python-port-live-agreement.md`
- path: `almanac/getting-started.md`
  - slug: `getting-started`
  - purpose: Give future agents the shortest useful reading path through the wiki.
  - planned links: `concepts/local-repo-wiki`, `architecture/lifecycle/workflows`, `architecture/wiki/index-refresh-and-search`, `guides/verify-a-wiki-change`
  - key evidence: `README.md`, `MANUAL.md`, `docs/python-port-live-agreement.md`

### Concepts

#### `concepts/`

- path: `almanac/concepts/local-repo-wiki.md`
  - slug: `concepts/local-repo-wiki`
  - purpose: Define a CodeAlmanac wiki as committed nested Markdown plus local derived state.
  - planned links: `architecture/wiki/page-identity`, `decisions/local-only-python-product`, `reference/page-format/frontmatter-and-sources`
  - key evidence: `README.md`, `src/codealmanac/prompts/base/kernel.md`, `docs/python-port-live-agreement.md`
- path: `almanac/concepts/lifecycle-operation.md`
  - slug: `concepts/lifecycle-operation`
  - purpose: Explain build, ingest, and garden as the only page-writing operation kinds.
  - planned links: `architecture/lifecycle/workflows`, `architecture/lifecycle/operation-runner`, `reference/runs/run-states-and-events`
  - key evidence: `src/codealmanac/workflows/build/service.py`, `src/codealmanac/workflows/ingest/service.py`, `src/codealmanac/workflows/garden/service.py`
- path: `almanac/concepts/source-material.md`
  - slug: `concepts/source-material`
  - purpose: Distinguish selected ingest inputs from page evidence in `sources:`.
  - planned links: `architecture/sources/source-resolution-and-runtime`, `reference/sources/source-addresses`, `reference/page-format/frontmatter-and-sources`
  - key evidence: `src/codealmanac/services/sources/service.py`, `src/codealmanac/manual/sources.md`, `src/codealmanac/services/wiki/frontmatter.py`
- path: `almanac/concepts/run-ledger.md`
  - slug: `concepts/run-ledger`
  - purpose: Define runs, jobs, queued specs, run events, and attach/log inspection as one local ledger.
  - planned links: `architecture/lifecycle/run-queue-and-sync`, `reference/runs/run-states-and-events`, `guides/debug-a-failed-lifecycle-run`
  - key evidence: `src/codealmanac/services/runs/service.py`, `src/codealmanac/services/runs/store.py`, `src/codealmanac/cli/parser/jobs.py`
- path: `almanac/concepts/page-graph.md`
  - slug: `concepts/page-graph`
  - purpose: Explain pages, topics, links, backlinks, file references, and health as one graph.
  - planned links: `architecture/wiki/topics-dag`, `architecture/wiki/health-and-validation`, `reference/topics-yaml`
  - key evidence: `src/codealmanac/services/index/schema.py`, `src/codealmanac/services/wiki/links.py`, `src/codealmanac/services/index/health_views.py`

### Architecture

#### `architecture/`

- path: `almanac/architecture/service-boundaries.md`
  - slug: `architecture/service-boundaries`
  - purpose: Explain the dependency rule from CLI/server through app, workflows, services, stores, ports, and integrations.
  - planned links: `architecture/composition-root`, `architecture/request-models`, `reference/cosmic-python-translation`
  - key evidence: `docs/reference/cosmic-python/CODEALMANAC.md`, `src/codealmanac/app.py`, `tests/test_architecture.py`
- path: `almanac/architecture/composition-root.md`
  - slug: `architecture/composition-root`
  - purpose: Explain `create_app`, adapter injection, service construction, and workflow assembly.
  - planned links: `architecture/service-boundaries`, `architecture/lifecycle/workflows`, `architecture/agent-runs/harness-contract`
  - key evidence: `src/codealmanac/app.py`, `docs/reference/cosmic-python/CODEALMANAC.md`, `tests/test_architecture.py`
- path: `almanac/architecture/request-models.md`
  - slug: `architecture/request-models`
  - purpose: Explain typed request objects as command boundaries between CLI, workflows, and services.
  - planned links: `architecture/service-boundaries`, `guides/add-a-cli-command`, `reference/cli/public-command-surface`
  - key evidence: `src/codealmanac/workflows/ingest/requests.py`, `src/codealmanac/services/search/requests.py`, `src/codealmanac/services/runs/models.py`

#### `architecture/cli/`

- path: `almanac/architecture/cli/adapter-boundary.md`
  - slug: `architecture/cli/adapter-boundary`
  - purpose: Explain parser, dispatch, and render as separate CLI adapter responsibilities.
  - planned links: `architecture/service-boundaries`, `reference/cli/public-command-surface`, `guides/add-a-cli-command`
  - key evidence: `src/codealmanac/cli/main.py`, `src/codealmanac/cli/parser/root.py`, `src/codealmanac/cli/dispatch/root.py`, `src/codealmanac/cli/render/root.py`
- path: `almanac/architecture/cli/terminal-output.md`
  - slug: `architecture/cli/terminal-output`
  - purpose: Explain why terminal output is behavior and how render modules own human text.
  - planned links: `reference/cli/json-output-contract`, `reference/cli/error-and-exit-code-contract`, `guides/add-a-cli-command`
  - key evidence: `src/codealmanac/cli/render/style.py`, `src/codealmanac/cli/render/common.py`, `src/codealmanac/cli/render/search.py`, `tests/test_cli.py`

#### `architecture/repositories/`

- path: `almanac/architecture/repositories/local-state.md`
  - slug: `architecture/repositories/local-state`
  - purpose: Explain global local state, repository rows, config, update locks, and per-repository runtime directories.
  - planned links: `decisions/local-only-python-product`, `reference/local-state-layout`, `architecture/persistence/sqlite-store-boundaries`
  - key evidence: `src/codealmanac/settings.py`, `src/codealmanac/core/paths.py`, `src/codealmanac/services/repositories/service.py`
- path: `almanac/architecture/repositories/selection-and-root.md`
  - slug: `architecture/repositories/selection-and-root`
  - purpose: Explain exact repository selection, fixed `almanac/` root, and initialized marker files.
  - planned links: `decisions/only-almanac-root`, `architecture/lifecycle/workflows`, `reference/local-state-layout`
  - key evidence: `src/codealmanac/services/repositories/roots.py`, `src/codealmanac/services/repositories/service.py`, `tests/test_public_contract.py`

#### `architecture/wiki/`

- path: `almanac/architecture/wiki/page-identity.md`
  - slug: `architecture/wiki/page-identity`
  - purpose: Explain nested Markdown page identity, `README.md` routes, reserved folders, and route collisions.
  - planned links: `concepts/local-repo-wiki`, `reference/page-format/links-and-routes`, `architecture/wiki/index-refresh-and-search`
  - key evidence: `src/codealmanac/services/wiki/paths.py`, `src/codealmanac/services/wiki/documents.py`, `tests/test_wiki_parsing.py`
- path: `almanac/architecture/wiki/index-refresh-and-search.md`
  - slug: `architecture/wiki/index-refresh-and-search`
  - purpose: Explain the derived FTS5 read model, freshness signatures, implicit refresh, and forced reindex.
  - planned links: `architecture/persistence/sqlite-store-boundaries`, `architecture/wiki/path-normalization-and-file-refs`, `reference/cli/public-command-surface`
  - key evidence: `src/codealmanac/services/index/service.py`, `src/codealmanac/services/index/store.py`, `src/codealmanac/services/index/sources.py`, `src/codealmanac/services/index/search_views.py`
- path: `almanac/architecture/wiki/path-normalization-and-file-refs.md`
  - slug: `architecture/wiki/path-normalization-and-file-refs`
  - purpose: Explain file-reference normalization, directory suffixes, casefolding, parent matches, and escaped `GLOB`.
  - planned links: `architecture/wiki/index-refresh-and-search`, `reference/page-format/frontmatter-and-sources`, `decisions/markdown-links-and-sources`
  - key evidence: `src/codealmanac/services/wiki/paths.py`, `src/codealmanac/services/index/search_views.py`, `docs/plans/fixes-slice-2-review.md`
- path: `almanac/architecture/wiki/topics-dag.md`
  - slug: `architecture/wiki/topics-dag`
  - purpose: Explain `topics.yaml`, page topics, topic mutation commands, DAG reads, and cycle prevention.
  - planned links: `concepts/page-graph`, `reference/topics-yaml`, `guides/maintain-topics`
  - key evidence: `src/codealmanac/services/topics/mutations.py`, `src/codealmanac/services/topics/graph.py`, `src/codealmanac/services/wiki/topic_file.py`, `tests/test_topics_mutation.py`
- path: `almanac/architecture/wiki/health-and-validation.md`
  - slug: `architecture/wiki/health-and-validation`
  - purpose: Explain health checks, validation, source/citation hygiene, and lifecycle final validation.
  - planned links: `concepts/page-graph`, `guides/verify-a-wiki-change`, `architecture/lifecycle/operation-runner`
  - key evidence: `src/codealmanac/services/health/service.py`, `src/codealmanac/services/index/health_views.py`, `src/codealmanac/services/health/sources.py`, `tests/test_validate.py`

#### `architecture/lifecycle/`

- path: `almanac/architecture/lifecycle/workflows.md`
  - slug: `architecture/lifecycle/workflows`
  - purpose: Compare build, ingest, and garden responsibilities and explain why sync is not an operation.
  - planned links: `concepts/lifecycle-operation`, `architecture/lifecycle/operation-runner`, `architecture/sources/source-resolution-and-runtime`
  - key evidence: `src/codealmanac/workflows/build/service.py`, `src/codealmanac/workflows/ingest/service.py`, `src/codealmanac/workflows/garden/service.py`, `src/codealmanac/workflows/sync/service.py`
- path: `almanac/architecture/lifecycle/operation-runner.md`
  - slug: `architecture/lifecycle/operation-runner`
  - purpose: Explain shared lifecycle execution from run start through harness, safety validation, indexing, and terminal state.
  - planned links: `architecture/lifecycle/mutation-safety`, `architecture/agent-runs/harness-contract`, `guides/debug-a-failed-lifecycle-run`
  - key evidence: `src/codealmanac/workflows/operations/service.py`, `src/codealmanac/workflows/operations/harness.py`, `src/codealmanac/workflows/operations/mutation.py`
- path: `almanac/architecture/lifecycle/mutation-safety.md`
  - slug: `architecture/lifecycle/mutation-safety`
  - purpose: Explain Git snapshots, changed-file validation, and the rule that lifecycle agents may only mutate `almanac/`.
  - planned links: `architecture/lifecycle/operation-runner`, `decisions/auto-commit-is-prompt-policy`, `guides/verify-a-wiki-change`
  - key evidence: `src/codealmanac/workflows/operations/mutation.py`, `src/codealmanac/workflows/change_tracking.py`, `src/codealmanac/integrations/repositories/git/probe.py`
- path: `almanac/architecture/lifecycle/run-queue-and-sync.md`
  - slug: `architecture/lifecycle/run-queue-and-sync`
  - purpose: Explain queued run specs, worker draining, transcript sync, scheduled Garden, and hidden worker commands.
  - planned links: `concepts/run-ledger`, `reference/runs/run-states-and-events`, `architecture/setup/automation-and-update`
  - key evidence: `src/codealmanac/workflows/run_queue/service.py`, `src/codealmanac/workflows/run_queue/worker.py`, `src/codealmanac/workflows/sync/service.py`, `src/codealmanac/integrations/runs/process.py`

#### `architecture/agent-runs/`

- path: `almanac/architecture/agent-runs/harness-contract.md`
  - slug: `architecture/agent-runs/harness-contract`
  - purpose: Explain readiness checks, run requests, normalized harness results, events, transcript refs, and changed-file reporting.
  - planned links: `architecture/lifecycle/operation-runner`, `architecture/agent-runs/provider-adapters`, `reference/harness-event-shape`
  - key evidence: `src/codealmanac/services/harnesses/ports.py`, `src/codealmanac/services/harnesses/results.py`, `src/codealmanac/services/harnesses/events.py`, `src/codealmanac/services/harnesses/service.py`
- path: `almanac/architecture/agent-runs/provider-adapters.md`
  - slug: `architecture/agent-runs/provider-adapters`
  - purpose: Explain Codex app-server and Claude SDK adapters as provider edges behind the harness contract.
  - planned links: `architecture/agent-runs/harness-contract`, `decisions/controlled-model-catalog`, `guides/add-a-harness-provider-adapter`
  - key evidence: `src/codealmanac/integrations/harnesses/codex/adapter.py`, `src/codealmanac/integrations/harnesses/codex/app_server.py`, `src/codealmanac/integrations/harnesses/claude/adapter.py`, `tests/test_codex_app_server_adapter.py`, `tests/test_claude_adapter.py`

#### `architecture/sources/`

- path: `almanac/architecture/sources/source-resolution-and-runtime.md`
  - slug: `architecture/sources/source-resolution-and-runtime`
  - purpose: Explain raw source address resolution and bounded runtime snapshot loading for ingest prompts.
  - planned links: `concepts/source-material`, `reference/sources/source-addresses`, `guides/add-a-source-runtime-adapter`
  - key evidence: `src/codealmanac/services/sources/service.py`, `src/codealmanac/services/sources/address_resolution.py`, `src/codealmanac/integrations/sources/runtime.py`, `tests/test_sources_service.py`

#### `architecture/runtime-resources/`

- path: `almanac/architecture/runtime-resources/prompts-and-manuals.md`
  - slug: `architecture/runtime-resources/prompts-and-manuals`
  - purpose: Explain packaged prompt and manual resources and how lifecycle workflows render operation prompts.
  - planned links: `architecture/lifecycle/workflows`, `decisions/no-propose-apply-or-dry-run`, `reference/page-format/frontmatter-and-sources`
  - key evidence: `src/codealmanac/prompts/renderer.py`, `src/codealmanac/manual/library.py`, `pyproject.toml`, `src/codealmanac/workflows/build/service.py`

#### `architecture/setup/`

- path: `almanac/architecture/setup/automation-and-update.md`
  - slug: `architecture/setup/automation-and-update`
  - purpose: Explain setup, uninstall, automation, update, launchd scheduling, and machine-level state.
  - planned links: `guides/setup-local-automation`, `reference/config-keys`, `architecture/repositories/local-state`
  - key evidence: `src/codealmanac/services/setup/service.py`, `src/codealmanac/services/automation/service.py`, `src/codealmanac/services/updates/service.py`, `src/codealmanac/integrations/automation/scheduler/launchd.py`

#### `architecture/viewer/`

- path: `almanac/architecture/viewer/local-viewer.md`
  - slug: `architecture/viewer/local-viewer`
  - purpose: Explain the local FastAPI/static viewer projection over wiki, topics, files, and jobs.
  - planned links: `architecture/wiki/index-refresh-and-search`, `architecture/lifecycle/run-queue-and-sync`, `reference/cli/public-command-surface`
  - key evidence: `src/codealmanac/services/viewer/service.py`, `src/codealmanac/services/viewer/projections.py`, `src/codealmanac/server/assets/viewer/main.js`, `tests/test_viewer_service.py`

#### `architecture/persistence/`

- path: `almanac/architecture/persistence/sqlite-store-boundaries.md`
  - slug: `architecture/persistence/sqlite-store-boundaries`
  - purpose: Explain shared SQLite helpers, local database migrations, and store-owned schemas/query behavior.
  - planned links: `architecture/repositories/local-state`, `architecture/wiki/index-refresh-and-search`, `reference/local-state-layout`
  - key evidence: `src/codealmanac/database/sqlite.py`, `src/codealmanac/database/local.py`, `src/codealmanac/services/index/schema.py`, `src/codealmanac/services/runs/tables.py`, `src/codealmanac/services/repositories/tables.py`

### Decisions

#### `decisions/`

- path: `almanac/decisions/local-only-python-product.md`
  - slug: `decisions/local-only-python-product`
  - purpose: Record the reset to a local-only Python product and the rejection of hosted/cloud public workflow language.
  - planned links: `concepts/local-repo-wiki`, `architecture/repositories/local-state`, `decisions/only-almanac-root`
  - key evidence: `docs/python-port-live-agreement.md`, `notes.md`, `README.md`, `MANUAL.md`
- path: `almanac/decisions/only-almanac-root.md`
  - slug: `decisions/only-almanac-root`
  - purpose: Record the decision that repo wiki source lives only under `almanac/`.
  - planned links: `architecture/repositories/selection-and-root`, `architecture/wiki/page-identity`, `reference/local-state-layout`
  - key evidence: `docs/python-port-live-agreement.md`, `src/codealmanac/services/repositories/roots.py`, `tests/test_public_contract.py`
- path: `almanac/decisions/markdown-links-and-sources.md`
  - slug: `decisions/markdown-links-and-sources`
  - purpose: Record the choice to use Markdown links and structured `sources:` instead of wikilinks or retired file-list fields.
  - planned links: `reference/page-format/links-and-routes`, `reference/page-format/frontmatter-and-sources`, `architecture/wiki/path-normalization-and-file-refs`
  - key evidence: `src/codealmanac/prompts/base/kernel.md`, `src/codealmanac/services/wiki/frontmatter.py`, `src/codealmanac/services/wiki/links.py`, `docs/plans/2026-07-06-sources-canonical.md`
- path: `almanac/decisions/auto-commit-is-prompt-policy.md`
  - slug: `decisions/auto-commit-is-prompt-policy`
  - purpose: Record that auto-commit is permission in the prompt, not Python-side staging or commit orchestration.
  - planned links: `architecture/lifecycle/mutation-safety`, `architecture/runtime-resources/prompts-and-manuals`, `guides/verify-a-wiki-change`
  - key evidence: `docs/python-port-live-agreement.md`, `src/codealmanac/workflows/operations/commit.py`, `src/codealmanac/workflows/build/service.py`
- path: `almanac/decisions/no-propose-apply-or-dry-run.md`
  - slug: `decisions/no-propose-apply-or-dry-run`
  - purpose: Record why agent judgment lives in prompts rather than proposal files, dry-run rehearsals, or apply state machines.
  - planned links: `architecture/runtime-resources/prompts-and-manuals`, `architecture/lifecycle/operation-runner`, `decisions/auto-commit-is-prompt-policy`
  - key evidence: `MANUAL.md`, `docs/python-port-live-agreement.md`, `src/codealmanac/prompts/operations/ingest.md`, `src/codealmanac/prompts/operations/garden.md`
- path: `almanac/decisions/controlled-model-catalog.md`
  - slug: `decisions/controlled-model-catalog`
  - purpose: Record that CodeAlmanac owns a controlled runner/model configuration instead of discovering arbitrary provider models.
  - planned links: `architecture/agent-runs/provider-adapters`, `architecture/setup/automation-and-update`, `reference/config-keys`
  - key evidence: `src/codealmanac/services/config/models.py`, `src/codealmanac/services/config/service.py`, `tests/test_controlled_model_config.py`, `docs/plans/2026-07-07-controlled-model-config.md`

### Guides

#### `guides/`

- path: `almanac/guides/verify-a-wiki-change.md`
  - slug: `guides/verify-a-wiki-change`
  - purpose: Show how to validate wiki source changes with health, validate, search, and file mention checks.
  - planned links: `architecture/wiki/health-and-validation`, `reference/page-format/frontmatter-and-sources`, `reference/cli/public-command-surface`
  - key evidence: `README.md`, `src/codealmanac/cli/parser/wiki.py`, `src/codealmanac/services/health/service.py`
- path: `almanac/guides/debug-a-failed-lifecycle-run.md`
  - slug: `guides/debug-a-failed-lifecycle-run`
  - purpose: Show how to inspect failed build/ingest/garden jobs through run records, logs, attach, and validation failures.
  - planned links: `concepts/run-ledger`, `architecture/lifecycle/operation-runner`, `reference/runs/run-states-and-events`
  - key evidence: `src/codealmanac/cli/parser/jobs.py`, `src/codealmanac/cli/dispatch/jobs.py`, `src/codealmanac/services/runs/service.py`, `src/codealmanac/workflows/operations/service.py`
- path: `almanac/guides/add-a-cli-command.md`
  - slug: `guides/add-a-cli-command`
  - purpose: Show where to add parser, dispatch, render, request model, service/workflow code, and tests for a new command.
  - planned links: `architecture/cli/adapter-boundary`, `architecture/request-models`, `reference/cli/public-command-surface`
  - key evidence: `src/codealmanac/cli/parser/root.py`, `src/codealmanac/cli/dispatch/root.py`, `src/codealmanac/cli/render/root.py`, `tests/test_architecture.py`
- path: `almanac/guides/add-a-source-runtime-adapter.md`
  - slug: `guides/add-a-source-runtime-adapter`
  - purpose: Show how to add or change source resolution/runtime support without leaking raw external shapes downstream.
  - planned links: `architecture/sources/source-resolution-and-runtime`, `concepts/source-material`, `reference/sources/source-addresses`
  - key evidence: `src/codealmanac/services/sources/ports.py`, `src/codealmanac/integrations/sources/filesystem/adapter.py`, `src/codealmanac/integrations/sources/github/adapter.py`, `tests/test_sources_service.py`
- path: `almanac/guides/add-a-harness-provider-adapter.md`
  - slug: `guides/add-a-harness-provider-adapter`
  - purpose: Show how to implement a new agent provider behind the harness contract.
  - planned links: `architecture/agent-runs/harness-contract`, `architecture/agent-runs/provider-adapters`, `reference/harness-event-shape`
  - key evidence: `src/codealmanac/services/harnesses/ports.py`, `src/codealmanac/integrations/harnesses/codex/adapter.py`, `src/codealmanac/integrations/harnesses/claude/adapter.py`, `tests/test_harnesses_service.py`
- path: `almanac/guides/maintain-topics.md`
  - slug: `guides/maintain-topics`
  - purpose: Show how to update topic metadata and page topics safely.
  - planned links: `architecture/wiki/topics-dag`, `reference/topics-yaml`, `concepts/page-graph`
  - key evidence: `src/codealmanac/cli/parser/wiki.py`, `src/codealmanac/services/topics/mutations.py`, `src/codealmanac/manual/topics.md`, `tests/test_topics_mutation.py`
- path: `almanac/guides/setup-local-automation.md`
  - slug: `guides/setup-local-automation`
  - purpose: Show how setup, automation install/status, sync, garden, update, and uninstall should be used and verified locally.
  - planned links: `architecture/setup/automation-and-update`, `reference/config-keys`, `architecture/lifecycle/run-queue-and-sync`
  - key evidence: `README.md`, `src/codealmanac/cli/parser/setup.py`, `src/codealmanac/cli/parser/automation.py`, `src/codealmanac/services/setup/service.py`
- path: `almanac/guides/refactoring-boundaries.md`
  - slug: `guides/refactoring-boundaries`
  - purpose: Give maintainers the practical refactor standard for this repo: reshape around honest boundaries and preserve behavior gates.
  - planned links: `architecture/service-boundaries`, `architecture/composition-root`, `reference/cosmic-python-translation`
  - key evidence: `MANUAL.md`, `docs/reference/cosmic-python/CODEALMANAC.md`, `docs/plans/2026-06-08-architecture-cleanup.md`, `tests/test_architecture.py`

### Reference

#### `reference/cli/`

- path: `almanac/reference/cli/public-command-surface.md`
  - slug: `reference/cli/public-command-surface`
  - purpose: List the public command families, hidden internal commands, and intentionally absent legacy/cloud commands.
  - planned links: `architecture/cli/adapter-boundary`, `architecture/lifecycle/workflows`, `guides/add-a-cli-command`
  - key evidence: `pyproject.toml`, `src/codealmanac/cli/parser/root.py`, `src/codealmanac/cli/parser/run_commands.py`, `src/codealmanac/cli/parser/wiki.py`, `src/codealmanac/cli/parser/admin.py`
- path: `almanac/reference/cli/json-output-contract.md`
  - slug: `reference/cli/json-output-contract`
  - purpose: Define `--json` as the machine-readable command output surface.
  - planned links: `architecture/cli/terminal-output`, `reference/cli/public-command-surface`, `reference/cli/error-and-exit-code-contract`
  - key evidence: `src/codealmanac/cli/render/common.py`, `src/codealmanac/cli/render/run_commands.py`, `src/codealmanac/cli/render/repositories.py`, `tests/test_cli.py`
- path: `almanac/reference/cli/error-and-exit-code-contract.md`
  - slug: `reference/cli/error-and-exit-code-contract`
  - purpose: Define stderr and exit behavior for product errors, validation, and command outcomes.
  - planned links: `architecture/cli/terminal-output`, `reference/cli/public-command-surface`
  - key evidence: `src/codealmanac/cli/main.py`, `src/codealmanac/core/errors.py`, `src/codealmanac/cli/render/health.py`, `tests/test_validate.py`

#### `reference/page-format/`

- path: `almanac/reference/page-format/frontmatter-and-sources.md`
  - slug: `reference/page-format/frontmatter-and-sources`
  - purpose: Define supported page frontmatter, `sources:` entry shape, source target fields, and citation expectations.
  - planned links: `decisions/markdown-links-and-sources`, `concepts/source-material`, `architecture/wiki/health-and-validation`
  - key evidence: `src/codealmanac/services/wiki/frontmatter.py`, `src/codealmanac/services/wiki/models.py`, `src/codealmanac/manual/evidence.md`
- path: `almanac/reference/page-format/links-and-routes.md`
  - slug: `reference/page-format/links-and-routes`
  - purpose: Define Markdown page-link behavior, relative links, folder README routes, and broken-link validation.
  - planned links: `architecture/wiki/page-identity`, `decisions/markdown-links-and-sources`, `guides/verify-a-wiki-change`
  - key evidence: `src/codealmanac/services/wiki/links.py`, `src/codealmanac/services/wiki/paths.py`, `src/codealmanac/manual/links.md`

#### `reference/sources/`

- path: `almanac/reference/sources/source-addresses.md`
  - slug: `reference/sources/source-addresses`
  - purpose: List accepted ingest source address forms and how they resolve.
  - planned links: `architecture/sources/source-resolution-and-runtime`, `concepts/source-material`, `guides/add-a-source-runtime-adapter`
  - key evidence: `src/codealmanac/services/sources/address_resolution.py`, `src/codealmanac/services/sources/address_github.py`, `src/codealmanac/services/sources/address_git.py`, `src/codealmanac/services/sources/address_web.py`, `src/codealmanac/services/sources/address_transcript.py`

#### `reference/runs/`

- path: `almanac/reference/runs/run-states-and-events.md`
  - slug: `reference/runs/run-states-and-events`
  - purpose: Define run kinds, statuses, event kinds, queued specs, cancellation behavior, and attach/log semantics.
  - planned links: `concepts/run-ledger`, `architecture/lifecycle/run-queue-and-sync`, `guides/debug-a-failed-lifecycle-run`
  - key evidence: `src/codealmanac/services/runs/models.py`, `src/codealmanac/services/runs/transitions.py`, `src/codealmanac/services/runs/events.py`, `src/codealmanac/services/runs/streaming.py`

#### `reference/`

- path: `almanac/reference/config-keys.md`
  - slug: `reference/config-keys`
  - purpose: Define current user/project config keys and precedence with CLI flags.
  - planned links: `architecture/setup/automation-and-update`, `decisions/controlled-model-catalog`, `guides/setup-local-automation`
  - key evidence: `README.md`, `src/codealmanac/services/config/models.py`, `src/codealmanac/services/config/service.py`, `src/codealmanac/cli/dispatch/config.py`
- path: `almanac/reference/local-state-layout.md`
  - slug: `reference/local-state-layout`
  - purpose: Define committed wiki source versus runtime state paths under `~/.codealmanac/`.
  - planned links: `architecture/repositories/local-state`, `architecture/persistence/sqlite-store-boundaries`, `decisions/only-almanac-root`
  - key evidence: `README.md`, `src/codealmanac/settings.py`, `src/codealmanac/core/paths.py`, `docs/python-port-live-agreement.md`
- path: `almanac/reference/topics-yaml.md`
  - slug: `reference/topics-yaml`
  - purpose: Define `topics.yaml` fields, topic slugs, parents, and mutation constraints.
  - planned links: `architecture/wiki/topics-dag`, `guides/maintain-topics`, `concepts/page-graph`
  - key evidence: `src/codealmanac/services/wiki/topic_models.py`, `src/codealmanac/services/wiki/topic_file.py`, `src/codealmanac/manual/topics.md`
- path: `almanac/reference/harness-event-shape.md`
  - slug: `reference/harness-event-shape`
  - purpose: Define normalized harness event kinds, tool display fields, usage, failure, and agent trace payloads.
  - planned links: `architecture/agent-runs/harness-contract`, `architecture/agent-runs/provider-adapters`, `guides/add-a-harness-provider-adapter`
  - key evidence: `src/codealmanac/services/harnesses/events.py`, `src/codealmanac/services/harnesses/results.py`, `src/codealmanac/services/harnesses/actors.py`
- path: `almanac/reference/cosmic-python-translation.md`
  - slug: `reference/cosmic-python-translation`
  - purpose: Record how this repo translates Architecture Patterns with Python into its own service/store/port/composition rules.
  - planned links: `architecture/service-boundaries`, `architecture/composition-root`, `guides/refactoring-boundaries`
  - key evidence: `docs/reference/cosmic-python/CODEALMANAC.md`, `docs/reference/cosmic-python/chapter_04_service_layer.md`, `docs/reference/cosmic-python/chapter_13_dependency_injection.md`, `MANUAL.md`
