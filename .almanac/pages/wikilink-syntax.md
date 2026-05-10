---
title: Wikilink Syntax
topics: [systems, decisions]
files:
  - src/indexer/wikilinks.ts
  - src/indexer/index.ts
  - src/indexer/schema.ts
---

# Wikilink Syntax

codealmanac uses a single `[[...]]` syntax for all intra-page references, disambiguated by content at index time. There is no second link form — `[[...]]` covers page slugs, file refs, folder refs, and cross-wiki refs.

<!-- stub: fill in edge cases and classifier gotchas as discovered -->

## Classification rules

The indexer in `src/indexer/wikilinks.ts` classifies each `[[...]]` link into one of four categories:

| Pattern | Category | Example |
|---------|----------|---------|
| Contains `:` before any `/` | Cross-wiki | `openalmanac:supabase` inside brackets |
| Contains `/` (no preceding `:`) | File ref | `src/checkout/handler.ts` inside brackets |
| Trailing `/` | Folder ref | `src/checkout/` inside brackets |
| None of the above | Page slug | `checkout-flow` inside brackets |

## Storage

- Page slugs → `wikilinks` table (`source_slug`, `target_slug`)
- File/folder refs → `file_refs` table (`page_slug`, `path`, `original_path`, `is_dir`)
- Cross-wiki → `cross_wiki_links` table (`source_slug`, `target_wiki`, `target_slug`)

## Path normalization in file_refs

`path` is stored lowercase (for case-insensitive GLOB queries on macOS). `original_path` is stored as-written for display and for case-sensitive dead-ref checks on Linux. Queries use `GLOB` not `LIKE` — `LIKE` treats `_` as a wildcard, which produces spurious matches on paths like `src/my_module/`. GLOB metacharacters (`*?[`) in stored paths are escaped before use in GLOB patterns.

## Why one syntax

A second syntax (e.g. markdown links versus bracketed slugs) would require agents to learn two conventions and the indexer to maintain two parsers. Disambiguation by content keeps authoring unambiguous and the classifier trivially correct for the common cases.
