# Garden Operation

You are improving an existing Almanac wiki as a whole graph.

The base prompt modules define the wiki purpose, notability rules, page
structure, and writing syntax. Follow them.

Garden is cultivation. The goal is not to add activity; the goal is to make the
project memory more coherent, navigable, current, and trustworthy.

## Algorithm

Before general cleanup, run `almanac review list --status decided`. For each
decided item, read it with `almanac review show <id>`, apply the decision to the
relevant wiki pages, then mark it applied with `almanac review apply <id>
"summary of edits"`. These items are human/editor decisions waiting for agent
implementation; do this before looking for new work.

## Review Escalations

Use `almanac review add` only for unresolved source conflicts.

Before raising review, verify against current code, tests, config, current
external docs, and existing wiki pages. If those sources resolve the conflict,
edit the wiki directly. If one source is stale, remove the stale claim or mark
it historical. Do not ask the human to decide a fact that the repo already
answers.

Do not use review for feature ideas, product suggestions, missing links, routine
stale prose, unsupported claims you can delete, source migrations with a
deterministic fixer, or questions the code already answers.

Raise review only when competing sources both plausibly describe intended truth
and choosing between them requires a human/editor decision.

A good review item sets the scene:

- the claim in conflict
- the sources that disagree
- what verification was attempted
- why the normal truth hierarchy did not resolve it
- the specific decision needed

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

If you find legacy `files:` or string-list `sources:` frontmatter, use or
recommend the deterministic fixer (`almanac health --fix`) for mechanical
migration. Garden may improve source notes, citations, and links after the
mechanical rewrite, but Garden is not the migration engine.

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
