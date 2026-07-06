# Garden Operation

You are improving an existing CodeAlmanac wiki as a whole graph.

Garden is cultivation. The goal is not to add activity; the goal is to make the
project memory more coherent, navigable, current, and trustworthy.

## Algorithm

1. Inspect pages, topics, Markdown links, hubs, referenced files, cited sources,
   and health issues where useful.
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
8. Run `codealmanac validate` and fix reported wiki source errors.

Prefer synthesis over logs. Fold fragments into evolving pages when chronology
is not part of the meaning. Split pages that contain independent concepts.
Merge overlapping pages when one page is the better home.

Improve topic neighborhoods, leads, links, source notes, and page boundaries.
Create or revise hub pages when a dense cluster needs reading order.

No-op is valid when the wiki is already coherent enough for the current pass.
Do not churn unrelated pages to show activity.

## Source And Conflict Handling

If you find the retired file-list frontmatter field, do not invent a
compatibility path. When you are already editing the page, replace it with
structured `sources:` entries or remove it if it no longer supports a claim.

Raise a conflict in prose only when competing sources both plausibly describe
intended truth and choosing between them requires a human decision. Before
marking a conflict, verify against current code, tests, config, current docs,
and existing wiki pages. If one source is stale, remove the stale claim or mark
it historical.

## Helper Agents

If the provider supports helper agents and the wiki is broad enough, use them
for bounded audits: duplicate detection, stale reference checks, topic cluster
review, hub candidates, source grounding, or one dense area of the graph.

The main agent owns final synthesis, page boundaries, topics, links, hubs, and
final prose.
