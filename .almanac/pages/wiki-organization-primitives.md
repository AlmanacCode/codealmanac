---
title: Wiki Organization Primitives
topics: [decisions, systems, agents]
files:
  - AGENTS.md
  - .almanac/README.md
  - docs/plans/2026-05-10-harness-process-architecture.md
  - prompts/operations/build.md
  - prompts/operations/absorb.md
  - prompts/operations/garden.md
---

# Wiki Organization Primitives

Almanac already has three core wiki primitives: pages, double-bracket links, and a topic DAG. That is enough to store knowledge and query it, but it is not enough to keep the wiki coherent as capture volume grows. The missing pieces are editorial rather than storage-oriented: canonical homes for subjects, curated navigation for dense areas, explicit structural operations, and a maintenance loop that protects the graph over time.

This matters because a self-updating wiki fails by drift, not by lack of content. If the system can only create pages and append to pages, it tends to overproduce narrow pages, under-merge overlap, and leave readers with a technically linked graph that is still hard to traverse. V1 addresses part of that gap by making Garden a first-class operation beside Build and Absorb; anchors, hub pages, redirects, and alias behavior are still editorial primitives rather than enforced storage objects.

## What Almanac has now

The committed design and implementation provide these primitives:

- **Page**: one markdown file per slug in `.almanac/pages/`
- **Link**: unified double-bracket syntax for page, file, folder, and cross-wiki references
- **Topic**: a multi-parent DAG serialized in `.almanac/topics.yaml`
- **File reference**: explicit `files:` frontmatter plus inline file/folder wikilinks
- **Lineage for reversals**: `archived_at`, `superseded_by`, `supersedes`
- **Indexer-backed query surface**: search, show, list, topics, health
- **Operation prompts**: Build, Absorb, and Garden prompts name page-worthiness and graph-maintenance outcomes

These are real primitives, not just conventions. The SQLite index persists them, query commands read them, and the prompts rely on them. They are enough to answer "what pages exist?", "what links where?", and "what topic is this in?".

## What is missing

The current model does not yet make these concepts explicit:

- **Anchor page**: the canonical page that owns a major subject
- **Hub/index page**: a curated navigation page for a dense area
- **Redirect / alias**: a lightweight way to collapse alternate names onto a canonical page
- **Structural operation set**: create, update, merge, split, redirect, archive, no-op
- **Gardening loop**: a recurring pass that evaluates the health of the graph, not just the last ingest delta

Without these, the agent can still edit files, but the default behavior is biased toward "create a page" or "append to a page". That is not enough to preserve a wiki's shape.

## Anchor pages

An anchor page is the canonical home for a major subject. Future knowledge about that subject should usually update that page rather than create a sibling page.

Examples in this repo behave like anchors even though the storage model does not name them:

- [[sqlite-indexer]]
- [[topic-dag]]
- [[capture-flow]]
- [[build-operation]]
- [[wiki-lifecycle-operations]]
- [[process-manager-runs]]

The Build operation prompt is the first place that identifies anchors for a new wiki. Absorb and Garden should protect those anchors by updating the canonical page unless the new material clearly deserves an independent subject.

Anchor pages are how the wiki gets a single source of truth for major subjects. Without them, every ingest has to rediscover where a fact belongs.

## Hub / index pages

Topics answer "what belongs together?" They do not answer:

- where should a new reader start?
- which page is the primary overview?
- which pages are current architecture versus archived history?
- what order should a reader follow?
- which pages are core and which are edge cases?

That is the job of a hub page. A hub page is a normal wiki page whose subject is the organization of an area, not a single concept inside the area.

A payments hub in a codebase wiki could say:

- read checkout-flow first for request-time behavior
- treat stripe-async as the canonical current design
- read incident pages only after the architecture page
- treat stripe-sync as archived history, not current guidance

Topics cannot express that kind of editorial ordering or annotation. A topic is an index. A hub is a map.

## Why the structural operations need to be explicit

"Explicit" does not mean "hard-coded CLI subcommands for every move" and it does not mean "JSON workflow states". It means the editorial model needs to recognize these as legitimate outcomes:

- **create**: a new subject deserves its own page
- **update**: the subject already has a canonical home
- **merge**: two pages have the same scope or too much overlap
- **split**: one page now contains multiple independently useful subjects
- **redirect**: this title is useful but should resolve to another page
- **archive**: the old page is no longer current truth but still has historical value
- **no-op**: the ingest found facts, but they do not justify changing the wiki

If these outcomes are not named in the prompts and reviewer criteria, agents mostly perform create and update. Over time that produces page sprawl and weak canonicality. Merge, split, redirect, archive, and no-op are graph decisions, not just text edits.

## Generalized wiki model

A generalized self-updating wiki needs three layers of primitives.

### Content primitives

- page
- link
- category / topic
- source / provenance

These are the minimum needed to store knowledge and trace where it came from.

### Structure primitives

- canonical page identity
- anchor pages
- hub / index / list pages
- redirect / alias behavior
- lineage across reversals and renames

These are what keep the graph navigable and keep synonymous or overlapping subjects from fragmenting.

### Maintenance primitives

- page-worthiness policy
- merge / split / redirect / archive / no-op as allowed outcomes
- steward or gardening pass responsible for graph quality
- recurring gardening pass over the whole graph

Without the maintenance layer, ingestion keeps adding content but does not keep the graph healthy.

## Codebase wiki deltas

A codebase wiki needs two additional primitives earlier than a general wiki does:

- **file / folder refs** because pages need to point into the repo
- **strong steward authority** because the main challenge is preserving the shape of the graph while code changes quickly

The page-worthiness bar is also different. A general wiki asks whether a topic has enough independent substance and sources. A codebase wiki asks whether the page captures non-obvious knowledge that the code cannot say on its own: decisions, constraints, flows, incidents, migration state, and gotchas.

This is why a codebase wiki should default more strongly to updating anchors than a general-purpose research wiki would.

## Current gaps in Almanac

Three organizational gaps remain after V1.

1. **Anchors are informal.** Build identifies them through the operation prompt, but the storage model and subsequent Absorb/Garden runs have no explicit mechanism to protect them from fragmentation.

2. **Topics carry too much responsibility.** Topics are an index, not a map. They answer "what belongs together?" but cannot express reading order, distinguish canonical architecture from archived history, or annotate which page is the primary overview for an area.

3. **Redirects are under-modeled.** The design has archival lineage (`superseded_by`, `archived_at`) but no lightweight equivalent for alternate names or collapsed pages that should resolve to a canonical home.

These are design gaps, not indexing gaps. The storage model is already strong enough to support all three.

## Git history and wiki pollution

Git is the right history layer for wiki files. A second bespoke per-page version system is unnecessary.

For codebase wikis, the useful split is:

- **Git history** stores raw revision history
- **lineage metadata** stores conceptually important history such as supersession and archival

The real product issue is not missing versioning. It is commit pollution when `.almanac/` changes ride along with ordinary code commits.

There are four viable operating modes:

1. **Same repo, same commits**
   Simplest. Highest review noise.
2. **Same repo, separate wiki commits**
   Still local and shared. Cleaner history.
3. **Same repo, dedicated wiki branch**
   Keeps the wiki shared without polluting normal code history.
4. **Separate wiki repo**
   Clean separation, weakest locality.

For Almanac, the best near-term default is "same repo, separate wiki commits". The best medium-term option is an opt-in dedicated wiki branch mode.

## The core model

A maintainable wiki is not just "pages plus tags". It is:

- **knowledge units**: pages
- **relationships**: links
- **classification**: topics
- **canonical homes**: anchors
- **curated navigation**: hubs
- **historical continuity**: lineage
- **editorial discipline**: create/update/merge/split/redirect/archive/no-op
- **ongoing maintenance**: gardening

Almanac already has the first three strongly, part of the sixth, and a V1 gardening operation for the eighth. The next design work is to make the missing primitives first-class in prompts and conventions without turning them into a rigid pipeline.
