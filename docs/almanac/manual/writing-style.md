---
page_id: manual-writing-style
title: Writing Style
summary: How pages in this wiki should read.
topics: [manual]
sources:
  - id: structure-plan
    type: file
    path: docs/plans/opinionated-wiki-structure.md
---

# Writing Style

Every page in this wiki should read like a small encyclopedia article for a maintainer: it starts with a lead paragraph that explains the subject, then moves through sections in the order a careful reader would naturally ask about them. The agreed standard requires simple language, tight leads, and section headings that answer the reader's next question rather than merely labeling content. [@structure-plan]

## What should the lead do?

The lead should say what the page is about, why it matters, and where it fits. A reader who only reads the lead should still understand the page's point. [@structure-plan]

## How should the prose sound?

Use plain words. Prefer "is" over decorative phrasing. Cut sentences that could describe any codebase. Use tables when facts need comparison, and bullets only when the list is easier to scan than prose. [@structure-plan]

## How do pages stay connected?

Write each page as part of the graph. Link concepts to the architecture pages that use them, decisions to the systems they constrain, guides to reference pages, and reference pages back to task guides. See [[manual-sourcing-and-linking]] for the citation and linking rule.

