---
title: TypeScript Runtime Choice
summary: CodeAlmanac should stay TypeScript while it remains an npm-installed developer CLI, even though a Python port is technically feasible.
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
    path: src/edges/viewer/server.ts
    note: Shows the Node server layer for the local read-only wiki viewer.
  - id: indexer
    type: file
    path: src/stores/wiki/indexer/index.ts
    note: Shows the TypeScript indexer implementation over SQLite, frontmatter, topics, wikilinks, and sources.
  - id: sqlite-indexer-page
    type: file
    path: .almanac/pages/sqlite-indexer.md
    note: Documents the better-sqlite3 native-binding constraint that a Python port would remove from the query stack.
---

CodeAlmanac's current runtime choice is TypeScript. A Python port is feasible, but the current decision is to keep TypeScript while the product remains an npm-installed developer CLI with local wiki browsing, provider-backed lifecycle jobs, and Node package distribution. The user's main pressure in the 2026-06-07 porting discussion was personal TypeScript unfamiliarity, and the cheaper response is to make the TypeScript codebase easier to read rather than to rewrite the product runtime. [@porting-session]

## Current Runtime Shape

`[[./package.json|package.json]]` publishes `codealmanac`, `almanac`, and `alm` as npm bins that all resolve to `dist/launcher.js`, declares Node engine support, and ships TypeScript build output through `tsup`. That distribution shape is part of the product contract, not just an implementation detail. [@package-metadata]

The TypeScript surface spans several user-visible systems: the CLI entrypoint in `[[src/cli.ts]]`, the SQLite indexer in `[[src/stores/wiki/indexer/index.ts]]`, the write-capable job lifecycle in `[[src/jobs/executor.ts]]`, provider adapters such as `[[src/harness/providers/claude.ts]]`, and the local viewer server in `[[src/edges/viewer/server.ts]]`. A port would need to preserve those contracts together, not only translate syntax. [@cli-entry] [@indexer] [@process-manager] [@harness-provider] [@viewer-server]

The query stack's strongest Python argument is SQLite. `[[sqlite-indexer]]` currently depends on `better-sqlite3`, and the wiki already records the Node ABI failure mode plus the `[[install-time-node-launcher]]` mitigation. Python's standard SQLite runtime would remove that exact native Node binding constraint, but it would replace the npm install story with pipx, uv, Homebrew, or another distribution decision. [@sqlite-indexer-page] [@package-metadata]

## Porting Assessment

The 2026-06-07 session estimated a query-only Python port as medium difficulty and a full production-parity port as high difficulty. Query commands map cleanly to Python because path handling, YAML frontmatter, SQLite, topic DAGs, and filesystem traversal have direct Python equivalents. Full parity is harder because `[[process-manager-runs]]`, `[[harness-providers]]`, setup, update, automation, capture, Garden, and `[[almanac-serve]]` are product behavior boundaries with user-visible side effects. [@porting-session]

Python becomes more attractive if Almanac turns into a Python-native agent or documentation engine for ML, data, or research-heavy teams. TypeScript remains more attractive while the product's first install path is npm, the local viewer remains close to web tooling, and contributors expect a Node developer-tool package. [@porting-session] [@package-metadata]

## Decision Rule

Do not port CodeAlmanac to Python just to lower the maintainer's personal TypeScript learning cost. Treat that pressure as a documentation and architecture-readability problem: keep modules small, keep type boundaries explicit, and add a Python-reader-oriented guide if the TypeScript surface blocks real work.

Reconsider Python only if the product strategy changes. Valid triggers include a Python-first customer segment, a need to embed Almanac as a Python library, a decision to split a language-neutral core from CLI wrappers, or repeated distribution failures that the Node launcher and doctor path cannot solve.

## Related Pages

[[almanac-product-family]] explains the broader product scopes that could change the runtime decision. [[sqlite-indexer]] and [[install-time-node-launcher]] document the current Node ABI constraint. [[process-manager-runs]] and [[harness-providers]] document the runtime surfaces that make full parity harder than query-command parity.
