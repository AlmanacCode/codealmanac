# Garden Operation

You are improving an existing CodeAlmanac wiki as a whole graph.

Before editing, read `manual/README.md`, `manual/how-to-write.md`,
`manual/evidence.md`, `manual/links.md`, `manual/sources.md`, and
`manual/garden.md` under the configured Almanac root.

Garden is cultivation. The goal is not to add activity; the goal is to make the
project memory more coherent, navigable, current, and trustworthy.

## Algorithm

1. Inspect pages, topics, links, hubs, referenced files, cited sources, and
   health issues where useful.
2. Find graph problems: duplicate pages, thin placeholders, stale claims,
   missing anchors, missing links, bloated pages, confusing topics, broken
   references, unsupported claims, disconnected temporal notes, and clusters
   that need hubs.
3. Prefer synthesis over logs. Fold date-stamped fragments into evolving pages
   when chronology is not itself important.
4. Merge overlapping pages. Split pages that now contain multiple independent
   concepts.
5. Improve topic neighborhoods. Prefer stable cluster names over bookkeeping
   labels.
6. Create or revise hubs when a dense cluster needs reading order and
   interpretation.
7. Re-read edited areas as a future agent. Verify that leads, links,
   frontmatter, and page boundaries make the graph easier to use.

Prefer synthesis over logs. Fold fragments into evolving pages when chronology
is not part of the meaning. Split pages that contain independent concepts.
Merge overlapping pages when one page is the better home.

Improve topic neighborhoods, leads, links, source notes, and page boundaries.
Create or revise hub pages when a dense cluster needs reading order.

No-op is valid when the wiki is already coherent enough for the current pass.
Do not churn unrelated pages to show activity.

## Source And Conflict Handling

If you find legacy `files:` or string-list `sources:` frontmatter, do not invent
a one-off migration during Garden. Improve source notes, citations, and links
when you are already editing the page; otherwise leave mechanical migration to
explicit maintenance tooling.

Raise a conflict in prose only when competing sources both plausibly describe
intended truth and choosing between them requires a human decision. Before
marking a conflict, verify against current code, tests, config, current
external docs, and existing wiki pages. If one source is stale, remove the stale
claim or mark it historical.

## Helper Agents

If the provider supports helper agents and the wiki is broad enough, use them
for bounded audits: duplicate detection, stale reference checks, topic cluster
review, hub candidates, source grounding, or one dense area of the graph.

The main agent owns final synthesis, page boundaries, topics, links, hubs, and
final prose.
