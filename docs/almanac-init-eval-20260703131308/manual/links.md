---
title: Links
topics: [manual]
---

# Links

Use links to make the wiki a graph a future agent can follow. A good page
should not sit alone; it should point to the concepts, architecture, decisions,
guides, reference pages, files, and folders that help explain it.

Think of links like Wikipedia links. When the prose mentions a meaningful
concept, system area, decision, guide, reference, file, or folder that already
has a page or is being created in the same run, link it inline at the first
useful mention. Links should help the reader follow the article's meaning, not
feel like a checklist added afterward.

During init, use `coverage-map.md` as a link plan. The page inventory names
related planned pages; use those relationships when deciding what to link. If
the prose naturally mentions another planned page, link it.

Use `[[page-slug]]` for wiki pages. Use `[[src/path.py]]` for files and
`[[src/path/]]` for folders.

Only put real targets inside `[[...]]`. Do not use placeholder examples such as
`[[path/to/file.py]]` in a real page. Write placeholders as inline code instead.

Link intentionally. Do not link every noun. Link the page, file, or folder a
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

Link files and folders when they are useful retrieval anchors. File links help
a future agent find wiki pages by source path, but they should still be
relevant to the article.

Every real page should have useful inbound or outbound links unless it is a
local manual page. A page with no graph connections is usually too isolated,
too generic, or missing links.

`getting-started.md` is a routing page. It should tell readers where to start,
which dense clusters matter, and what to read next for common work areas.
