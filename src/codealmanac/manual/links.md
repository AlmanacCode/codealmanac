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

During build, use `coverage-map.md` as a link plan. The page inventory names
related planned pages; use those relationships when deciding what to link. If
the prose naturally mentions another planned page, link it.

Use normal Markdown links for wiki pages. Prefer extensionless relative links
inside the same documentation neighborhood:

```md
[Sources](../concepts/sources)
[Indexing](../architecture/indexing)
[Page format](../reference/page-format)
```

Markdown links should point to actual wiki pages, not folders. Folders are only
for organizing page files. If no page exists for a subject, mention it as plain
text instead of linking it.

Do not link to `README` in Markdown links. A folder README is addressed by the
folder route, such as `architecture`, not `architecture/README`.

Use kebab-case page routes. Do not invent underscore slugs.

Only link real targets. Do not leave placeholder links in finished pages. If a
subject is useful but does not yet deserve a page, mention it as plain text.

File and folder evidence belongs in `sources:` frontmatter with `type: file`,
not in inline page links.

Link intentionally. Do not link every noun. Link the page a
reader may actually follow to understand the subject, verify the claim, or move
to the next relevant part of the wiki.

Link related pages by role:

- concept pages should link to the architecture, guides, decisions, or
  references that use the concept
- architecture pages should link to the concepts they depend on, decisions that
  constrain them, guides that change them, and references that define exact
  contracts
- guide pages should link to background concepts, architecture, decisions, and
  reference pages instead of re-explaining them inline
- decision pages should link to the architecture areas they constrain and the
  concepts or references needed to understand the choice
- reference pages should link back to guides or architecture pages where the
  exact contract is used

Reference pages should still connect to the graph. When possible, link a
reference page back to the architecture or guide page where the contract is
used.

Every real page should have useful inbound or outbound links unless it is a
local manual page. A page with no graph connections is usually too isolated,
too generic, or missing links.

`getting-started.md` is a routing page. It should tell readers where to start,
which dense clusters matter, and what to read next for common work areas.
