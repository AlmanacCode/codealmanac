---
title: Global Registry
topics: [systems, storage]
files:
  - src/registry/index.ts
  - src/registry/autoregister.ts
  - src/paths.ts
  - src/commands/init.ts
  - src/commands/list.ts
  - src/cli/register-query-commands.ts
verified: 2026-05-13
---

# Global Registry

`~/.almanac/registry.json` is the single source of truth for which `.almanac/` wikis exist on the machine. Each entry records `name` (kebab-case slug), `description`, `path` (absolute repo root), and `registered_at`. The file lives outside any repo so it survives branch switches, clones, and deletions. The registry is local-only; there is no sync mechanism across machines. Cross-wiki links from [[wikilink-syntax]] and multi-wiki query commands resolve through this file.

## Read/write

`src/registry/index.ts` provides `readRegistry()` and `writeRegistry()`. Writes are atomic: content is written to a `.tmp` file, then renamed over the target. A missing registry file is treated as an empty array (first-run state); a malformed file is a hard error.

## Auto-registration

`src/registry/autoregister.ts` runs before most commands. If the cwd is inside a repo with `.almanac/` that isn't in the registry, it silently registers it — handles the case where someone clones a repo that already has `.almanac/` committed. Two commands skip auto-registration: `init` (registers explicitly) and `list --drop` (intent is to shrink the registry, not grow it).

## Entry lifecycle

Entries are never auto-dropped. `almanac list --drop <name>` is the only removal path. Unreachable paths (repo moved or deleted) are silently skipped during `--all` queries — they don't cause errors, just absent results.

`almanac list` is quiet by default: it prints reachable wiki names only, one per line, and prints nothing when there are no reachable entries. `almanac list --verbose` keeps the human-readable view with descriptions and absolute paths. `--json` remains the structured registry output, and `--drop` still reports the removal result because that is the command's effect.

## Multi-wiki queries

`almanac search --wiki <name>` resolves the name via the registry. `almanac search --all` iterates every registered entry, skipping unreachable ones. Cross-wiki links resolve `wiki:slug` targets through the registry at query time. Query commands still depend on each wiki's local [[sqlite-indexer]] database; the registry only answers which wiki roots to inspect.
