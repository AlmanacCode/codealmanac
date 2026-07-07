---
title: Legacy Almanac Migration
summary: The old repo wiki was migrated into the new nested almanac/ tree.
topics: [migration, decisions, wiki-design]
sources:
  - id: tickets
    type: file
    path: implementation-tickets.md
    note: Ticket 2.5 migration scope.
  - id: notes
    type: file
    path: notes.md
    note: Discussion of old `.almanac/` being outdated memory.
  - id: agreement
    type: file
    path: docs/python-port-live-agreement.md
    note: Current product fork point and no-compatibility decision.
---

# Legacy Almanac Migration

The old repo wiki under `.almanac/` described a mix of TypeScript-era behavior, hosted/cloud planning, business positioning, old flat page storage, and some durable local-product architecture memory. Ticket 2.5 migrates only the useful memory into the new nested `almanac/` tree [@tickets] [@notes].

The migrated memory keeps current local Python facts about wiki structure, indexing, runs, provider harnesses, sync, automation, source provenance, and the product fork point. It drops hosted deployment, login/connect/upload, fundraising, product-positioning, competitor research, old command aliases, old root choices, the old flat `pages/` model, old double-bracket link rules, and file-list compatibility as product guidance [@agreement] [@tickets].

The tracked `.almanac/` pages are removed from this branch after the migration so future agents see one active wiki source. Ignored runtime artifacts under `.almanac/` may remain in a developer checkout, but they are not product source.
