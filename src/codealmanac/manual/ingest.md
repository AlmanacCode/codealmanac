---
title: Ingest
topics: [manual]
---

# Ingest

Ingest folds selected local material into an existing `almanac/` wiki.

Read the new material, then read nearby pages, backlinks, topics, and local
wiki conventions. Decide what the material changes.

Update existing pages when the subject already has a home. Create a page only
when the material reveals a durable subject that needs one.

Do not summarize the input as a transcript report, file report, or activity
log. Distill the reusable project meaning into subject pages.

Use `sources:` entries for material that supports the edited page. Use Markdown
links to connect related pages. Do not use double-bracket links or the retired
file-list field.

No-op is valid when the input adds no durable wiki knowledge. If the input
exposes a graph problem, treat part of the run like Garden.

Before finishing, run `codealmanac validate` and fix wiki source errors that
the run introduced.
