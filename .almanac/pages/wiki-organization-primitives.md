---
title: Wiki Organization Primitives
summary: Almanac's current storage primitives are pages, links, topics, and lineage metadata, while anchors, hubs, redirects, and gardening remain editorial conventions layered on top.
topics: [decisions, systems, agents, wiki-design]
files:
  - AGENTS.md
  - .almanac/README.md
  - .gitignore
  - docs/plans/2026-05-10-harness-process-architecture.md
  - prompts/operations/build.md
  - prompts/operations/absorb.md
  - prompts/operations/garden.md
  - src/cli.ts
  - src/indexer/index.ts
  - src/commands/setup.ts
  - src/commands/automation.ts
sources:
  - /Users/rohan/.codex/sessions/2026/05/27/rollout-2026-05-27T15-50-50-019e6b34-4f03-7073-b36a-76aba85b3dcf.jsonl
  - /Users/rohan/.codex/sessions/2026/05/27/rollout-2026-05-27T16-27-22-019e6b55-bee7-79d3-ba21-2852c5372082.jsonl
  - /Users/rohan/.codex/sessions/2026/05/28/rollout-2026-05-28T12-14-55-019e6f94-fae1-7780-b2c9-3e2f3d6b6f3e.jsonl
  - https://diataxis.fr/
  - https://diataxis.fr/tutorials/
  - https://diataxis.fr/how-to-guides/
  - https://diataxis.fr/reference/
  - https://diataxis.fr/explanation/
  - https://diataxis.fr/map/
  - https://diataxis.fr/complex-hierarchies/
  - https://www.writethedocs.org/guide/
  - https://www.writethedocs.org/guide/docs-as-code/
  - https://www.writethedocs.org/guide/writing/beginners-guide-to-docs/
  - https://www.writethedocs.org/guide/starting/
  - https://www.writethedocs.org/guide/writing/mindshare/
  - https://www.writethedocs.org/guide/writing/docs-principles/
  - https://www.writethedocs.org/guide/writing/style-guides/
verified: 2026-05-28
---

# Wiki Organization Primitives

Almanac already has three core wiki primitives: pages, double-bracket links, and a topic DAG. That is enough to store knowledge and query it, but it is not enough to keep the wiki coherent as capture volume grows. The missing pieces are editorial rather than storage-oriented: canonical homes for subjects, curated navigation for dense areas, explicit structural operations, and a maintenance loop that protects the graph over time.

This matters because a self-updating wiki fails by drift, not by lack of content. If the system can only create pages and append to pages, it tends to overproduce narrow pages, under-merge overlap, and leave readers with a technically linked graph that is still hard to traverse. V1 addresses part of that gap by making Garden a first-class operation beside Build and Absorb; anchors, hub pages, redirects, and alias behavior are still editorial primitives rather than enforced storage objects.

[[documenting-software-architectures]] sharpened the organization model by distinguishing views from beyond-view material. CodeAlmanac can use module-style prose for implementation responsibilities, component-and-connector-style prose for runtime flows, allocation-style prose for source/index/viewer packaging, and cross-view prose for rationale, glossary terms, mappings, and currentness. That vocabulary should shape page leads, hubs, links, and section boundaries; it should not become frontmatter schema.

The 2026-05-27 design discussion rejected adding `subject:` and `type:` frontmatter for organization. `subject: capture` duplicates what strong slugs, titles, links, topics, and hubs already express, and it risks becoming a shadow folder hierarchy. `type: runtime-view` turns editorial roles into schema before the system has a mechanical need to query them. The durable rule is to use metadata only for facts the system needs to query mechanically; editorial meaning belongs in page names, opening paragraphs, links, topic membership, and hub prose.

A later 2026-05-27 discussion connected that model to Diataxis and Write the Docs. The durable conclusion is that CodeAlmanac needs a global graph-organization doctrine in addition to page notability and syntax rules. The likely product shape is a fourth base prompt module, `prompts/base/organization.md`, loaded between `prompts/base/syntax.md` and the selected operation prompt by [[operation-prompts]]. That module should define good wiki shape rather than add a rigid workflow: canonical homes, nearby sources, scoped repetition, currentness discipline, recurring Garden work, topics as browse neighborhoods, hubs as reading paths, and anchors as source-of-truth pages.

A 2026-05-28 manual discussion sharpened the public-facing quality bar for codebase wikis: a good codebase wiki lets a competent future agent or human make a safer code change faster. The manual should define editorial judgment rather than only formatting rules. Its core subjects are what deserves a page, how canonical entities and hubs work, how Diataxis maps onto agent-facing pages, why human-readable neutral prose matters, and how currentness and Garden keep the graph trustworthy.

A second 2026-05-28 organization discussion added the subject-neighborhood rule: a page is the unit of reading, but a neighborhood is the unit of understanding for major subjects. A serious subsystem or external dependency should not be forced into one oversized page. It should have an anchor page plus supporting pages for behavior, structure, contracts, rationale, constraints, failure modes, workflows, and sources when those subtopics have independent value.

A later 2026-05-28 manual discussion made sources and links the central quality problem for Almanac pages. Sources answer why a reader should believe a claim; links answer where the reader should go next. The product direction is claim-level traceability without unreadable citation clutter: substantial pages should expose source IDs, cite non-obvious claims close to the claim, and make web sources first-class alongside files, commits, PRs, conversations, manual notes, and prior wiki pages. The 2026-05-28 [[source-provenance]] implementation made structured `sources:` the canonical provenance field and derives file-aware retrieval from `sources[type=file]`, legacy `files:`, and inline file or folder wikilinks.

A follow-up critique from the same 2026-05-27 Codex session added a sharper writing-order rule: page composition must be planned before article prose starts. When a source batch contains several adjacent entities or facts, the agent should first decide the page set, the scope of each page, the facts each page excludes, and which neighboring page owns those excluded facts. That planning step is editorial doctrine, not a proposal/apply workflow; the final wiki should contain article prose, not the planning scratchpad, unless the plan itself becomes durable product memory.

The same session compared Almanac to [[superpaper]], an Obsidian-first personal knowledge system in `/Users/rohan/Documents/life`. The durable product distinction is that Almanac creates a project memory layer beside a repo, while Superpaper treats the vault itself as the primary knowledge graph. Almanac should borrow Superpaper's neighborhood retrieval, living-charter discipline, front-door knowledge map, and visible category-hub pattern, but it should not create a duplicate `.almanac/pages/` graph inside an existing Obsidian or Superpaper vault.

## What Almanac has now

The committed design and implementation provide these primitives:

- **Page**: one markdown file per slug in `.almanac/pages/`
- **Link**: unified double-bracket syntax for page, file, folder, and cross-wiki references
- **Topic**: a multi-parent DAG serialized in `.almanac/topics.yaml`
- **File reference**: `sources[type=file]` frontmatter, legacy `files:` frontmatter, and inline file/folder wikilinks
- **Lineage for reversals**: `archived_at`, `superseded_by`, `supersedes`
- **Indexer-backed query surface**: search, show, list, topics, health
- **Operation prompts**: Build, Absorb, and Garden prompts name page-worthiness and graph-maintenance outcomes

These are real primitives, not just conventions. The SQLite index persists them, query commands read them, and the prompts rely on them. They are enough to answer "what pages exist?", "what links where?", and "what topic is this in?".

## Committed state versus local derived state

The portable wiki is the markdown layer committed in the repo: `[[.almanac/pages/]]`, `[[.almanac/README.md]]`, and `[[.almanac/topics.yaml]]`. That is the project memory collaborators receive through normal git sync even if their machine has never installed the `almanac` CLI.

The disposable local layer is ignored by git. `[[./.gitignore]]` excludes `.almanac/index.db`, its WAL/SHM companions, `.almanac/runs/`, and `.almanac/logs/`. Those files are machine-local query and run artifacts, not part of the shared wiki corpus.

That split defines the no-install collaborator behavior. A contributor without `almanac` can still read the committed markdown files directly, but cannot run query commands such as `search`, `show`, or `health`, and will not have scheduled capture or Garden automation on that machine. If they later install the CLI, query commands recreate the local SQLite index from the committed markdown corpus and automation can then be enabled through setup.

## What is missing

The current model does not yet make these concepts explicit:

- **Anchor page**: the canonical page that owns a major subject
- **Hub/index page**: a curated navigation page for a dense area
- **Redirect / alias**: a lightweight way to collapse alternate names onto a canonical page
- **Structural operation set**: create, update, merge, split, redirect, archive, no-op
- **Gardening loop**: a recurring pass that evaluates the health of the graph, not just the last ingest delta

Without these, the agent can still edit files, but the default behavior is biased toward "create a page" or "append to a page". That is not enough to preserve a wiki's shape.

## Page naming before schema

A codebase wiki should organize around named project subjects before it organizes around note genres. A subject is the stable thing the project reasons about: a subsystem, command, operation, dependency, external competitor, product idea, or architectural concern. The subject page is the canonical home, and adjacent pages or sections answer specific reader questions about that subject.

For a subsystem such as capture, the cluster can contain an overview, implementation-responsibility prose, runtime-behavior prose, file-and-state-placement prose, an interface page for transcripts or run records, and rationale pages for decisions such as scheduler-backed capture. For an external product such as [[agentmemory-competitor]], the cluster can contain an external-reference page, a competitive-analysis section, and a product-positioning contrast.

This model makes naming more important than genre metadata. `agentmemory` should be a canonical subject name because agents and humans will search for that entity directly. A page named `agentmemory-competitor` is acceptable while the page's job is comparison, but a mature graph should avoid hiding first-class entities behind only genre-prefixed names.

The current convention does not add `subject:` or `type:` to frontmatter. A page that is the canonical runtime overview says that in its lead. A page that must be read before changing a contract links to the related contract page in prose. A hub orders a dense cluster when links and search results are no longer enough.

The 2026-05-28 manual discussion made that naming rule stronger for public examples and instruction pages. Architecture-documentation categories such as module view, runtime view, allocation view, and rationale are useful private lenses, but they should not appear as stiff page titles or file names by default. Reader-facing pages should translate those lenses into plain questions and subjects, such as "How the Indexer Works", "What Happens During Capture", "Where Almanac Stores Data", "Why Capture Runs After Sessions", "Adding a New Provider", or "Gotchas with SQLite Paths".

The same naming rule applies to surprise and caution pages. "Gotcha" is acceptable shorthand inside development conversation, but it is too casual for canonical page shapes and public instruction. Use "Failure Mode" when the page explains how something breaks, "Constraint" when it records a rule future work must preserve, "Known Issue" for an active unresolved problem, "Incident Note" for a failure discovered in a specific event, "Operational Note" for runtime or deployment caveats, and "Edge Case" for narrow behavior.

The manual itself should follow the same wiki rules it teaches. Instead of presenting a taxonomy-first architecture manual, it should read as a small wiki with pages such as "What Makes a Good Codebase Wiki", "What Deserves a Page", "How to Name Pages", "How to Link Pages", "How to Use Sources", "How to Keep a Wiki Current", "Example Payments Wiki", and "Bad Wiki Patterns". The durable design constraint is simple titles with rigorous leads, sources, links, and examples underneath.

The manual should prefer readable wikilinks in flowing prose. The canonical syntax is slug plus display text separated by a pipe, so a sentence should display "the Absorb operation" while targeting the relevant operation slug when the slug would interrupt reading. Slug-only links remain acceptable in title-like references such as "See [[capture-flow]]", but article prose should usually link the concept with natural display text.

Diataxis is useful to CodeAlmanac because it treats documentation structure as a map of reader needs rather than a list of content types. Its four needs map imperfectly but usefully onto an agent-facing wiki: tutorials become starting hubs, how-to guides become workflow pages, reference becomes contracts and schemas, and explanation becomes decisions, rationale, architecture, and gotchas. CodeAlmanac should not copy Diataxis as four top-level wiki buckets because the primary reader is a future coding agent acting on a codebase, not a human learning a product from scratch.

Superpaper sharpens the same rule from the other direction. Its `type` and `categories` axes fit a personal Obsidian vault because the vault is the product and the note graph is the interface. Almanac should not import that schema into codebase wikis unless a mechanical query need appears; its editorial meaning still belongs in strong slugs, leads, topics, links, backlinks, and hubs.

Write the Docs sharpens the operating model in four places. First, "where does this belong?" is a first-class documentation design question, so Almanac prompts should answer anchor, hub, workflow page, reference page, decision page, archive, or no-op before asking for new prose. Second, documentation needs ongoing care, so Garden is the maintenance loop that prevents graph drift rather than a cosmetic cleanup command. Third, docs tolerate scoped repetition better than code: a hub can repeat a subsystem purpose and a workflow page can repeat a warning from a contract page as long as canonical truth still has one home. Fourth, stale current docs are riskier than missing ideal docs, so Garden should prioritize wrong invariants near code over filling every theoretical page role.

Composition planning is the operational form of "where does this belong?" Before writing from a dense source set, Build and Absorb should identify the smallest coherent page set that avoids both cramming and thinning. Each planned page needs a positive scope, explicit exclusions, and links to adjacent pages that own repeated or nearby facts. For example, an organization source set can have one company anchor page, separate governance, equity, employment, tax identity, and person pages, and a record-inventory page only if the document set itself is a subject. The anchor can mention that the board changed, but the detailed consent mechanics belong in the governance page.

The same critique clarified that prose-first does not mean prose-only. Quick-fact tables, infobox-style summaries, timelines, and bullet lists are valid when they improve scanning and do not become a substitute for sourced article prose. A table of legal name, entity type, incorporation date, EIN, E-Verify ID, principal office, and worksite is useful on a company entity page because it gives a compact current snapshot; the governing claims still need to appear in the article body with their source context.

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

## Subject neighborhoods

A subject neighborhood is the cluster of pages that lets a future agent understand a major subsystem, dependency, product idea, or external entity without cramming every fact into the anchor page. The anchor page names the subject, explains why it matters to the project, and routes readers to nearby pages. Supporting pages exist only when a reader would search for or change that subtopic independently.

For [[claude-agent-sdk]], a mature neighborhood can include the anchor page, a page on running Claude agents, a Claude authentication page, a provider-boundary rationale page, a handled message-types reference, SDK constraints or failure modes, a workflow page for adding Claude-specific behavior, and a sources page only if the source set itself is complex enough to need an inventory. For [[capture-flow]], the neighborhood can include the capture anchor, runtime flow, jobs, operation prompt, transcript sources, constraints, debugging workflow, and the decision behind automatic capture.

The reusable pattern is anchor, behavior, structure, reference, rationale, constraints or failure modes, workflows, and sources. Small subjects may need only the anchor. Major subjects should grow into a neighborhood when one page would hide distinct contracts, runtime behavior, or change workflows from each other.

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

## GitHub Wiki lesson

GitHub Wiki is a useful external reference because its visible model is pages, links, a Home page, a custom sidebar, page history, and a separate Git-backed wiki repository. It is not primarily a folder-first docs tree. The lesson for CodeAlmanac is that a wiki can stay page-centric while still giving humans a default navigation path.

For Almanac, the analogous primitives are markdown pages, wikilinks, Git history, topic and file-aware retrieval, and `almanac serve` as the local viewer. Folders or separate browse maps should not become a second organization system. The durable organization still comes from strong slugs, titles, leads, topics, links, backlinks, file references, sources, lineage, and currentness.

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

Sources and links have separate jobs. Sources answer why a reader should believe a claim; links answer where a reader should go next. A page without visible sources is hard to trust, and a page without meaningful links is stranded even when its prose is accurate.

Source clarity is part of page quality, not a generic citation feature. A codebase-wiki source can be a source file, migration, test, config file, commit, PR, incident note, external documentation page, conversation, implementation session, manual note, prior wiki page, or research input. The page should expose those sources in frontmatter when they help retrieval and audit, and the prose should cite or name the source of non-obvious claims when the fact would otherwise look unsupported. Source lists should explain relevance instead of dumping paths; code establishes current behavior, tests establish intended behavior, conversations establish rationale, and external docs establish dependency semantics.

The desired source shape is an identified evidence object rather than a raw path list. [[source-provenance]] is the product contract for structured `sources:` entries that record `id`, `type`, `path` or `url`, `retrieved_at` for web sources, and a short note about what the source supports. Prose can then cite page-local source IDs next to claims. Almanac now indexes source records and reports missing citations, unused sources, duplicate source IDs, legacy frontmatter, and ambiguous legacy sources through `almanac health`; web-source retrieval policy remains an open product question.

Links are graph edges, not citations. They should connect named entities, prerequisite concepts, broader anchors, adjacent subsystems, rationale pages, constraints, workflows, and implementation files. The first meaningful mention of a load-bearing concept should usually be linked with readable display text when needed, but repeated words should not be linked mechanically. Creating a page includes placing it into the graph by linking it from likely entry points, hubs, anchors, and adjacent pages.

An example wiki is useful when it demonstrates those primitives without academic labels. A fictional payments-service wiki can show a Home page, Checkout Flow, Stripe, Orders, Webhook Handling, Idempotency, Database Tables, Why Webhooks Are Asynchronous, Refunds, and Deployment Config. That set covers implementation responsibilities, runtime behavior, external dependencies, state placement, and rationale while keeping titles readable.

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

The 2026-05-27 organization audit found that the wiki is mechanically healthy but editorially immature. `almanac health` reported zero orphans, stale pages, dead references, broken links, broken cross-wiki links, empty topics, empty pages, and slug collisions. The flat page layout, topic DAG, frontmatter, links, backlinks, and anchor pages are coherent enough for retrieval.

The remaining problems are editorial structure, not storage integrity. The `agents` topic mixes provider runtimes, operation prompts, external references, product direction, and wiki-organization theory. Page jobs such as decision, flow, subsystem overview, external reference, product synthesis, gotcha, and hub are still implicit in prose and topics, which is acceptable as long as titles, leads, links, and hubs make the job clear. External-reference pages such as [[documenting-software-architectures]], [[farzapedia]], [[mem0]], [[codex-supermemory]], and [[agentmemory-competitor]] need clearer separation from current CodeAlmanac architecture pages.

The audit identified three practical next moves: add narrower topics such as `wiki-design`, `external-references`, `competitive-research`, `architecture`, and `prompts`; add hub pages for architecture, agent runtime, wiki design, and product positioning when clusters become hard to traverse; and strengthen cross-links from weakly connected pages such as [[global-agent-instructions]] and [[claude-agent-sdk]]. It should not introduce frontmatter page types unless a future query feature creates a concrete mechanical need.

Three deeper organizational gaps remain after V1.

1. **Anchors are informal.** Build identifies them through the operation prompt, but the storage model and subsequent Absorb/Garden runs have no explicit mechanism to protect them from fragmentation.

2. **Topics carry too much responsibility.** Topics are an index, not a map. They answer "what belongs together?" but cannot express reading order, distinguish canonical architecture from archived history, or annotate which page is the primary overview for an area.

3. **Redirects are under-modeled.** The design has archival lineage (`superseded_by`, `archived_at`) but no lightweight equivalent for alternate names or collapsed pages that should resolve to a canonical home.

These are design gaps, not indexing gaps. The storage model is already strong enough to support all three.

## Git history and wiki pollution

Git is the right history layer for wiki files. A second bespoke per-page version system is unnecessary.

Write the Docs' docs-as-code model reinforces the same product shape: wiki source should remain plain text near the code, reviewable through normal Git workflows, and maintained as part of developer work rather than hidden in a separate content store.

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
