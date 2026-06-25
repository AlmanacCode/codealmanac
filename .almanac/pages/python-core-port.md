---
title: Python Core Port
summary: The sibling `../almanac` repository is the active Python/hosted Almanac implementation, while this repo remains the older TypeScript codebase-wiki package.
topics: [systems, decisions, product-positioning]
sources:
  - id: state-comparison-session
    type: conversation
    path: /Users/rohan/.codex/sessions/2026/06/22/rollout-2026-06-22T15-50-06-019ef186-d8dd-7d92-b5c9-b39e4468c891.jsonl
    note: Records the direct comparison among this TypeScript repo, the archived TypeScript shell under ../almanac/old, and the active Python port under ../almanac/src/almanac.
  - id: codealmanac-package
    type: file
    path: package.json
    note: Shows the current TypeScript package surface and packaged prompts without bundled manual or skills directories.
  - id: codealmanac-lifecycle-cli
    type: file
    path: src/cli/register-wiki-lifecycle-commands.ts
    note: Shows this repo's init, absorb, ingest-alias, sync, garden, and jobs command surface.
  - id: codealmanac-init-scaffold
    type: file
    path: src/init/scaffold.ts
    note: Shows this checkout's starter wiki/manual scaffold and runtime/content split.
  - id: old-general-package
    type: file
    path: /Users/rohan/Desktop/Projects/almanac/old/package.json
    note: Shows that the archived TypeScript general shell packaged manual and skills alongside prompts.
  - id: old-general-lifecycle-cli
    type: file
    path: /Users/rohan/Desktop/Projects/almanac/old/src/cli/register-wiki-lifecycle-commands.ts
    note: Shows the archived TypeScript shell's manual sync and source-backed ingest commands.
  - id: old-general-query-cli
    type: file
    path: /Users/rohan/Desktop/Projects/almanac/old/src/cli/register-query-commands.ts
    note: Shows the archived TypeScript shell's sources query command.
  - id: old-general-workspace
    type: file
    path: /Users/rohan/Desktop/Projects/almanac/old/src/wiki/workspace.ts
    note: Shows the archived TypeScript shell's wiki/, sources/, _manual/, and _meta/ workspace shape.
  - id: python-readme
    type: file
    path: /Users/rohan/Desktop/Projects/almanac/README.md
    note: States the current hosted Almanac product shape and the Python core's role as managed-worker machinery.
  - id: python-package
    type: file
    path: /Users/rohan/Desktop/Projects/almanac/pyproject.toml
    note: Shows the Python package, console script, dependencies, and packaged guides, manual, prompts, and skills.
  - id: python-hosted-cli
    type: file
    path: /Users/rohan/Desktop/Projects/almanac/src/almanac/cli/parser/hosted.py
    note: Shows hosted setup, login, create, use, upload, and garden CLI commands.
  - id: python-wiki-cli
    type: file
    path: /Users/rohan/Desktop/Projects/almanac/src/almanac/cli/parser/wiki.py
    note: Shows hosted/local wiki query commands such as show, search, pages, topics, sources, and jobs.
  - id: python-sources-cli
    type: file
    path: /Users/rohan/Desktop/Projects/almanac/src/almanac/cli/parser/sources.py
    note: Shows the Python port's source library inspection commands.
  - id: python-wiki-files
    type: file
    path: /Users/rohan/Desktop/Projects/almanac/src/almanac/services/wiki/pages/files.py
    note: Shows the Python core's wiki/, _manual/, _meta/, page file, and manual-sync filesystem services.
  - id: python-server
    type: file
    path: /Users/rohan/Desktop/Projects/almanac/src/almanac/server/app.py
    note: Shows the Python FastAPI server composition used by hosted and local development routes.
  - id: runtime-choice
    type: wiki
    slug: typescript-runtime-choice
    note: Explains the earlier TypeScript runtime decision that this page narrows.
  - id: product-family
    type: wiki
    slug: almanac-product-family
    note: Explains the broader Almanac product model that the Python port now implements more directly.
status: active
verified: 2026-06-25
---

# Python Core Port

The sibling repository at `/Users/rohan/Desktop/Projects/almanac` is the active Python and hosted-product implementation for Almanac. This `codealmanac` repository remains a TypeScript, npm-installed codebase-wiki implementation, so it is not the best source for newer general-Almanac concepts such as hosted wikis, source upload, source libraries, managed ingest jobs, bundled manuals, service-owned runs, server APIs, or the hosted frontend. [@python-readme] [@python-package] [@state-comparison-session]

## Current Relationship

`[[typescript-runtime-choice]]` records why this repo stayed TypeScript in the earlier codebase-wiki phase. That decision still describes this repo's local package shape, but it should not be read as a claim that all Almanac work remains TypeScript-first. The active Python repository uses `uv`, publishes the `the-almanac` Python package, exposes the `almanac` console script through `almanac.cli.main:main`, and ships guides, manual files, base prompts, operation prompts, and skills as package data. [@python-package] [@runtime-choice]

This repo has the concepts in partial or older form: root `MANUAL.md`, packaged operation prompts, `init`, `absorb`, an `ingest` alias, `sync`, `garden`, background jobs, the SQLite indexer, and a local viewer. Its npm package ships `prompts` and `guides`, but not bundled `manual` or `skills` directories, so it should not be treated as the complete general-Almanac runtime. [@codealmanac-package] [@codealmanac-lifecycle-cli] [@codealmanac-init-scaffold]

The current Python repository has moved past the local-only port described in the 2026-06-22 comparison session. Its README says hosted v1 is the active product surface: users log in, create or select a hosted wiki, upload source files or folders, run managed ingest or garden jobs, search pages, inspect hosted sources, and wait on jobs. The same README states that the local Python core remains because managed workers use the shared wiki/source machinery in temporary job workspaces; it is not the primary public v1 product surface. [@python-readme] [@python-hosted-cli] [@python-wiki-cli] [@python-sources-cli]

The Python core still owns local product machinery that this TypeScript repo lacks or only approximates: `wiki/` page files, `wiki/_manual/`, `wiki/_meta/`, bundled manual copying and syncing, source library services, run services, and a FastAPI server that can install hosted or local routes. [@python-wiki-files] [@python-server] [@python-readme]

## Archived TypeScript Shell

`../almanac/old` is the archived TypeScript general-Almanac shell. It had more of the general-source model than this repo: bundled manual files, source skills, `almanac manual sync`, `almanac sources`, source-backed `ingest`, `wiki/`, `sources/`, `wiki/_manual/`, and `wiki/_meta/`. It is historical context for concepts that later moved into the Python and hosted implementation, not the current implementation to extend first. [@old-general-package] [@old-general-lifecycle-cli] [@old-general-query-cli] [@old-general-workspace] [@state-comparison-session]

## How To Use This

When changing this repo's local CLI, indexer, capture flow, provider harness, or codebase-wiki behavior, trust the current TypeScript code in this checkout. When asking whether a concept is missing or out of date, compare against `/Users/rohan/Desktop/Projects/almanac/README.md` and `/Users/rohan/Desktop/Projects/almanac/src/almanac/` before designing from this repo alone. [@codealmanac-lifecycle-cli] [@python-readme]

The project-level product model remains [[almanac-product-family|Almanac as a maintained project knowledge layer]]. The Python/hosted repository is the newer implementation direction for the general source-grounded product, while this repo preserves the older local codebase-wiki package and its accumulated design history. [@product-family] [@python-readme] [@state-comparison-session]
