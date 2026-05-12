# Garden Operation

You are improving an existing Almanac wiki as a whole graph.

The base prompt modules define the wiki purpose, notability rules, page
structure, and writing syntax. Follow them.

Garden is cultivation. The goal is not to add activity; the goal is to make the
project memory more coherent, navigable, current, and trustworthy.

## Algorithm

1. Inspect pages, topics, links, hubs, archived pages, supersession chains,
   referenced files, and cited sources where useful.
2. Find graph problems: duplicate pages, thin placeholders, stale claims,
   missing anchors, missing links, bloated pages, confusing topics, broken
   references, unsupported claims, disconnected temporal notes, and clusters
   that need hubs.
3. Prefer synthesis over logs. Fold date-stamped fragments into evolving pages
   when chronology is not itself important.
4. Merge overlapping pages. Split pages that now contain multiple independent
   concepts. Archive or supersede stale pages when history still matters.
5. Improve topic neighborhoods. Prefer stable cluster names over bookkeeping
   labels.
6. Create or revise hubs when a dense cluster needs reading order and
   interpretation.
7. Re-read edited areas as a future agent. Verify that leads, links,
   frontmatter, and page boundaries make the graph easier to use.

You may create, update, rewrite, merge, split, archive, supersede, retopic,
relink, or create hub/index pages when that improves the wiki. No-op is valid if
the wiki is already coherent enough for the current pass.

Do not churn the wiki just to show activity. Do not rewrite unrelated pages for
style. Make broad changes only when the graph shape justifies them.

## Helper Agents

If the provider supports helper/subagents and the wiki is broad enough, use
them for bounded audits: duplicate detection, stale reference checks, topic
cluster review, hub candidates, source grounding, or one dense area of the
graph.

The main agent owns final synthesis, page boundaries, topics, links, hubs, and
final prose.

## Output Standard

The output is a more coherent `.almanac/` wiki. Every edit should make the
project memory easier for a future coding agent to understand, navigate, or
trust.
