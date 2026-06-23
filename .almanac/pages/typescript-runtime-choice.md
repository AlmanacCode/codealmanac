---
title: TypeScript Runtime Choice
summary: CodeAlmanac remains a TypeScript npm CLI, but the sibling Python port is now the newer implementation for general Almanac concepts.
topics: [decisions, stack, cli]
sources:
  - id: porting-session
    type: conversation
    path: /Users/rohan/.codex/sessions/2026/06/07/rollout-2026-06-07T16-49-50-019ea47e-243e-7720-9b29-2721fbe37fd1.jsonl
    note: Records the Python-porting question, the user's TypeScript familiarity concern, the porting estimate, and the recommendation to keep TypeScript for now.
  - id: package-metadata
    type: file
    path: package.json
    note: Shows the npm package shape, published bins, Node engine range, scripts, and runtime dependencies.
  - id: cli-entry
    type: file
    path: src/cli.ts
    note: Wires the TypeScript CLI entrypoint and command registration.
  - id: process-manager
    type: file
    path: src/jobs/executor.ts
    note: Owns write-capable operation execution, job records, event logs, snapshots, and post-run indexing.
  - id: harness-provider
    type: file
    path: src/harness/providers/claude.ts
    note: Shows a concrete provider adapter that maps Almanac run specs into provider runtime calls.
  - id: viewer-server
    type: file
    path: src/viewer/server.ts
    note: Shows the Node server layer for the local read-only wiki viewer.
  - id: indexer
    type: file
    path: src/wiki/indexer/index.ts
    note: Shows the TypeScript indexer implementation over SQLite, frontmatter, topics, wikilinks, and sources.
  - id: sqlite-indexer-page
    type: file
    path: .almanac/pages/sqlite-indexer.md
    note: Documents the better-sqlite3 native-binding constraint that a Python port would remove from the query stack.
  - id: state-comparison-session
    type: conversation
    path: /Users/rohan/.codex/sessions/2026/06/22/rollout-2026-06-22T15-50-06-019ef186-d8dd-7d92-b5c9-b39e4468c891.jsonl
    note: Records the later comparison that found this repo narrower than ../almanac/old and behind the active Python port for general manual, source, run, server, and viewer concepts.
---

CodeAlmanac's current runtime choice in this repository is TypeScript. The earlier decision was to keep this repo TypeScript while it remained an npm-installed developer CLI with local wiki browsing, provider-backed lifecycle jobs, and Node package distribution. The later [[python-core-port]] comparison narrows that claim: `/Users/rohan/Desktop/Projects/almanac` now contains the active Python port for general Almanac concepts, while this repo remains the older and narrower codebase-wiki implementation. [@porting-session] [@state-comparison-session]

## Current Runtime Shape

`[[./package.json|package.json]]` publishes `codealmanac`, `almanac`, and `alm` as npm bins that all resolve to `dist/launcher.js`, declares Node engine support, and ships TypeScript build output through `tsup`. That distribution shape is part of the product contract, not just an implementation detail. [@package-metadata]

The TypeScript surface spans several user-visible systems: the CLI entrypoint in `[[src/cli.ts]]`, the SQLite indexer in `[[src/wiki/indexer/index.ts]]`, the write-capable job lifecycle in `[[src/jobs/executor.ts]]`, provider adapters such as `[[src/harness/providers/claude.ts]]`, and the local viewer server in `[[src/viewer/server.ts]]`. A port would need to preserve those contracts together, not only translate syntax. [@cli-entry] [@indexer] [@process-manager] [@harness-provider] [@viewer-server]

The query stack's strongest Python argument is SQLite. `[[sqlite-indexer]]` currently depends on `better-sqlite3`, and the wiki already records the Node ABI failure mode plus the `[[install-time-node-launcher]]` mitigation. Python's standard SQLite runtime would remove that exact native Node binding constraint, but it would replace the npm install story with pipx, uv, Homebrew, or another distribution decision. [@sqlite-indexer-page] [@package-metadata]

## Porting Assessment

The 2026-06-07 session estimated a query-only Python port as medium difficulty and a full production-parity port as high difficulty. Query commands map cleanly to Python because path handling, YAML frontmatter, SQLite, topic DAGs, and filesystem traversal have direct Python equivalents. Full parity is harder because `[[process-manager-runs]]`, `[[harness-providers]]`, setup, update, automation, capture, Garden, and `[[almanac-serve]]` are product behavior boundaries with user-visible side effects. [@porting-session]

Python becomes more attractive if Almanac turns into a Python-native agent or documentation engine for ML, data, or research-heavy teams. TypeScript remains more attractive while the product's first install path is npm, the local viewer remains close to web tooling, and contributors expect a Node developer-tool package. [@porting-session] [@package-metadata]

## Relationship To The Python Port

The active sibling Python port lives under `/Users/rohan/Desktop/Projects/almanac/src/almanac/`. It has first-class bundled manual files, package data for prompts and skills, `manual sync`, a durable `sources` catalog, source-backed `ingest`, run-ledger services, server routes, and a separate React/Vite viewer over the Python server API. Those surfaces are newer than this repo's TypeScript implementation for general Almanac work. [@state-comparison-session]

This repo has partial equivalents: root `MANUAL.md`, operation prompts, `absorb`, an `ingest` alias, source provenance for page frontmatter, local capture, and a local viewer. It does not ship the full manual bundle, source-library workflow, source-backed ingest architecture, or service-owned Python run/source/provenance model. Future agents should read [[python-core-port]] before deciding whether to backport a general-Almanac concept into this TypeScript codebase. [@state-comparison-session]

## Decision Rule

Do not port this TypeScript repo to Python just to lower the maintainer's personal TypeScript learning cost. Treat that pressure as a documentation and architecture-readability problem: keep modules small, keep type boundaries explicit, and add a Python-reader-oriented guide if the TypeScript surface blocks real work.

Reconsider this repo's runtime only if the local codebase-wiki package needs to converge with the active Python port or if the product strategy changes. Valid triggers include a Python-first customer segment, a need to embed Almanac as a Python library, a decision to split a language-neutral core from CLI wrappers, or repeated distribution failures that the Node launcher and doctor path cannot solve. [@state-comparison-session]

## Related Pages

[[python-core-port]] explains the sibling Python implementation that now carries the newer general-Almanac concepts. [[almanac-product-family]] explains the broader product scopes that could change this repo's runtime decision. [[sqlite-indexer]] and [[install-time-node-launcher]] document the current Node ABI constraint. [[process-manager-runs]] and [[harness-providers]] document the runtime surfaces that make full parity harder than query-command parity.
