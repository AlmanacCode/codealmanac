---
title: Garden
topics: [manual]
---

# Garden

Garden improves the existing wiki graph.

Look for stale claims, duplicate pages, weak leads, missing Markdown links,
broken file sources, confusing topics, unsupported claims, disconnected
temporal notes, and clusters that need hubs.

Broken page links should be resolved by linking to the right existing page,
creating a justified page, or changing the mention back to plain text.

Prefer synthesis over activity logs. Fold fragments into durable pages when
chronology is not part of the meaning.

When a page still has the retired file-list frontmatter field and you are
already editing it, replace the field with structured `sources:` entries or
remove it if it no longer supports a claim.

No-op is valid when the wiki is coherent enough for the current pass.

Before finishing, run `codealmanac validate` and fix wiki source errors that
the run introduced.
