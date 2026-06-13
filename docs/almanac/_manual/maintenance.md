---
page_id: wiki-maintenance
title: Wiki Maintenance
topics: [concepts]
sources:
  - id: prompt-absorb
    type: file
    path: prompts/operations/absorb.md
    note: Defines how session and input material should be absorbed into durable pages.
  - id: prompt-garden
    type: file
    path: prompts/operations/garden.md
    note: Defines whole-graph maintenance behavior.
  - id: decision-log
    type: file
    path: docs/plans/2026-06-13-docs-almanac-decision-log.md
    note: Records the migration and maintenance decisions for docs/almanac.
---

# Wiki Maintenance

Maintain the wiki by editing the page that owns the subject. Do not add a new
page for every conversation, diff, or idea. [@prompt-absorb]

## Absorb

Absorb starts from concrete input and asks what durable understanding changed.
It should update existing pages first, create a page only when a durable subject
needs a home, and no-op when the input does not improve the wiki. [@prompt-absorb]

## Garden

Garden improves the whole graph. It should fix duplicate pages, weak leads,
stale claims, missing links, noisy topics, crowded folders, and active notes
that should be folded into durable pages. [@prompt-garden]

## Active Work

`active/` is for current investigations and unsettled design threads. Keep it
small. Once a thread becomes settled, move the useful knowledge into the right
durable page and either delete the active note or rewrite it as a short pointer.

## Migration

Legacy `.almanac/pages/` pages remain indexed during migration. When a legacy
page is migrated, keep the durable knowledge, improve citations, choose a
readable folder home, and preserve useful history in the new page. [@decision-log]
