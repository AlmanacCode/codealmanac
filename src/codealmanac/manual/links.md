---
title: Links
topics: [manual]
---

# Links

Use links to make the wiki a graph a future agent can follow. A good page
should not sit alone; it should point to the concepts, architecture, decisions,
guides, reference pages, and hubs that help explain it.

Think of links like Wikipedia links. When prose mentions a meaningful concept,
system area, decision, guide, or reference page that already exists or is being
created in the same run, link it inline at the first useful mention.

Use normal Markdown links for wiki pages. Prefer extensionless relative links
inside the same documentation neighborhood:

```md
[Sources](../concepts/sources)
[Indexing](../architecture/indexing)
[Page format](../reference/page-format)
```

Only link real targets. Do not leave placeholder links in finished pages. If a
subject is useful but does not yet deserve a page, mention it as plain text.

File and folder evidence belongs in `sources:` frontmatter with `type: file`,
not in inline page links.

Link intentionally. Do not link every noun. Link the page a reader may actually
follow to understand the subject, verify the claim, or move to the next
relevant part of the wiki.

Every real page should have useful inbound or outbound links unless it is a
local manual page. A page with no graph connections is usually too isolated,
too generic, or missing links.
