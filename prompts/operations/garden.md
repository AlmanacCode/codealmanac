# Garden Operation

You are improving an existing Almanac wiki as a whole graph.

The base prompt modules define the wiki purpose, page-selection rules, folder
structure, and writing syntax. Follow them.

Garden is cultivation. The goal is not activity; the goal is a wiki that is
more coherent, readable, current, and trustworthy.

## Review Queue First

Before general cleanup, run `almanac review list --status decided`. For each
decided item, read it with `almanac review show <id>`, apply the decision to the
relevant wiki pages, then mark it applied with:

```bash
almanac review apply <id> "summary of edits"
```

These items are human/editor decisions waiting for agent implementation. Handle
them before looking for new work.

## Review Escalations

Use `almanac review add` only for unresolved source conflicts.

Before raising review, verify against current code, tests, config, current
external docs, and existing wiki pages. If those sources resolve the conflict,
edit the wiki directly. If one source is stale, remove the stale claim or mark
it historical.

Do not use review for feature ideas, product suggestions, missing links,
routine stale prose, unsupported claims you can delete, source migrations with a
deterministic fixer, or questions the code already answers.

A good review item states the claim in conflict, the disagreeing sources, what
verification was attempted, why the normal truth hierarchy did not resolve it,
and the specific decision needed.

## Algorithm

1. Inspect pages, folders, topics, links, hubs, legacy pages, supersession
   chains, referenced files, and cited sources where useful.
2. Find graph problems: duplicate pages, thin placeholders, stale claims,
   missing anchors, missing links, bloated pages, confusing folders, noisy
   topics, broken references, unsupported claims, and old active notes.
3. Prefer synthesis over logs. Fold date-stamped fragments into evolving pages
   when chronology is not itself important.
4. Merge overlapping pages. Split pages whose title can no longer describe the
   subject cleanly. Preserve useful history in the surviving page.
5. Move pages to the folder where a new maintainer would expect to browse them.
6. Improve topic neighborhoods after folder placement is clear.
7. Create or revise hubs when a dense cluster needs reading order and
   interpretation.
8. Re-read edited areas as a new maintainer. Verify that leads, links,
   frontmatter, citations, folders, and page boundaries make the wiki easier to
   use.

If you find legacy `files:` or old-layout `.almanac/pages/` content, migrate
only when the run explicitly covers migration. Otherwise, keep compatibility in
mind and improve the canonical `docs/almanac/` pages you touch.

You may create, update, rewrite, move, merge, split, archive by prose, retopic,
relink, or create hub/index pages when that improves the wiki. No-op is valid if
the wiki is already coherent enough for the current pass.

Do not churn the wiki just to show activity. Do not rewrite unrelated pages for
style. Make broad changes only when the graph shape justifies them.

## Helper Agents

If the provider supports helper/subagents and the wiki is broad enough, use
them for bounded audits: duplicate detection, stale reference checks, folder
review, topic cluster review, hub candidates, source grounding, or one dense
area of the graph.

The main agent owns final synthesis, page boundaries, folders, topics, links,
hubs, and final prose.

## Output Standard

The output is a more coherent `docs/almanac/` wiki. Every edit should make the
project memory easier for a human maintainer or future coding agent to
understand, navigate, or trust.
