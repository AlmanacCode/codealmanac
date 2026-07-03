---
title: Getting Started
topics: [overview]
sources:
  - id: readme
    type: file
    path: README.md
  - id: map
    type: file
    path: eval-almanac/coverage-map.md
---

# Getting Started

This wiki is the durable map for the Python CodeAlmanac repo. Start here when you need to change the CLI, lifecycle jobs, source ingestion, harnesses, local update flow, cloud support, or the wiki read model; the pages below point to the architecture, decisions, guides, and exact references that keep those changes safe [@map].

## First Reads

Read [[concepts-repo-owned-wiki]] and [[concepts-configured-almanac-root]] before touching wiki storage. They explain why repo wiki source lives under a configured root and why code should use workspace models instead of hard-coded paths.

Read [[app-composition-root]] and [[services-workflows-integrations-boundary]] before changing runtime wiring. The app composition root wires services, workflows, and integrations, and architecture tests enforce that services and workflows do not import integrations directly [@readme].

Read [[cli-adapter-boundary]] and [[cli-command-surface-reference]] before changing commands. The public command is `codealmanac`, and parser, dispatch, and render modules are split by command family [@readme].

## Common Work Areas

- Wiki reads and indexing: [[wiki-page-model-and-link-parser]], [[sqlite-index-read-model]], [[search-show-health-flow]], [[change-the-index-guide]].
- Lifecycle writes: [[concepts-lifecycle-operation]], [[lifecycle-page-run-workflow]], [[init-ingest-garden-workflows]], [[run-ledger-and-job-queue]].
- Source material: [[concepts-source-material]], [[source-resolution-and-runtimes]], [[source-address-syntax-reference]].
- Harnesses: [[concepts-normalized-harness-event]], [[harness-service-contract]], [[codex-app-server-harness]], [[claude-sdk-harness]].
- Local update automation: [[concepts-local-control-plane]], [[local-control-db]], [[local-trigger-to-delivery-flow]], [[work-on-local-update-flow-guide]].
- Setup, automation, cloud, and viewer: [[setup-instruction-installers]], [[automation-launchd]], [[cloud-cli-workflows]], [[viewer-server-and-static-ui]].

## Exact Lookup Pages

Use [[user-and-repo-state-paths-reference]] for state paths, [[wiki-file-format-reference]] for page frontmatter, [[wikilink-syntax-reference]] for link classification, [[index-schema-reference]] for `index.db`, [[control-db-schema-reference]] for `control.sqlite`, [[run-ledger-files-reference]] for job files, [[sync-ledger-format-reference]] for transcript sync state, and [[release-and-test-gates-reference]] before shipping changes.
