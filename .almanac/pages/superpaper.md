---
title: Superpaper
summary: Superpaper is an Obsidian-first personal knowledge system whose operating discipline informs Almanac, while its schema and vault ownership model should not be copied into codebase wikis.
topics: [wiki-design, product-positioning, agents]
sources:
  - /Users/rohan/.codex/sessions/2026/05/27/rollout-2026-05-27T16-27-22-019e6b55-bee7-79d3-ba21-2852c5372082.jsonl
  - /Users/rohan/Documents/life/AGENTS.md
  - /Users/rohan/Documents/life/.agents/skills/superpaper/SKILL.md
  - /Users/rohan/Documents/life/superpaper/Knowledge map.md
  - /Users/rohan/Documents/life/_templates/
verified: 2026-05-27
---

# Superpaper

Superpaper is an Obsidian-first personal knowledge system used in `/Users/rohan/Documents/life`. It treats the vault as the primary work product, not as a corpus beside a derived wiki. That makes it a useful contrast for [[wiki-organization-primitives]] because Almanac treats `.almanac/pages/` as project memory beside code, while Superpaper treats existing notes, Bases, templates, backlinks, and category pages as the knowledge graph itself.

## What it is in the life vault

The life vault has no `.almanac/` directory in the inspected state. Its root `AGENTS.md` instructs agents to load `.agents/skills/superpaper/SKILL.md`, read the vault before acting, write small link-dense notes, and update `AGENTS.md` when the human changes a convention.

The vault's visible organization includes `superpaper/Knowledge map.md`, `superpaper/categories/`, `people/`, `organizations/`, `_templates/`, Obsidian Bases, daily notes, projects, concepts, and local agent skills. Superpaper's own protocol says folders are entity type, `categories` are the browse axis, `type` is the structural role, and Obsidian backlinks and unresolved links are part of retrieval.

Superpaper treats each mature category as a three-part surface: a template for starting notes, a Base view for querying notes, and a human category page for browsing. That "category trinity" is a stronger human-facing organization model than Almanac's current `topics.yaml` entries, which are queryable by the CLI but are not themselves readable hub pages.

`superpaper/Knowledge map.md` is the vault front door. Its intended role is to show recent additions, clusters, statistics, and important entry points. Almanac's closest equivalent is a generated or curated getting-started page, but the Superpaper comparison makes the front-door role more explicit: a mature wiki needs a human-readable map in addition to search and topic filters.

## Contrast with Almanac

Superpaper is stronger than Almanac as a personal knowledge operating system. Its protocol names a daily operating loop: retrieve a neighborhood, use backlinks and outgoing links, check unlinked mentions, respect human-written originals, update the local charter when preferences change, and use Obsidian as the interface rather than treating markdown files as inert text.

Almanac is stronger as a codebase memory layer. It has repo-root discovery, `files:` frontmatter, `almanac search --mentions src/foo.ts`, scheduled capture from coding sessions, code-oriented Build and Absorb prompts, health checks for dead file refs and broken wiki links, and Git review as the collaboration layer.

The central distinction is ownership. In Superpaper, the note is the work product. In Almanac, the repo is the work product and the wiki preserves what the code cannot say.

## Product implication

Almanac should distinguish between creating a wiki for an unstructured project and attaching to an existing knowledge system. In an Obsidian or Superpaper vault, Almanac should not create a shadow `.almanac/pages/` graph that duplicates the vault's notes. It should index, search, garden, and respect the vault's existing `AGENTS.md`, templates, category pages, Bases, backlinks, folder rules, and Obsidian rendering model.

For a codebase, `.almanac/pages/` remains the canonical memory layer because the source code is not itself a wiki. For `/Users/rohan/Documents/life`, Superpaper is already the knowledge graph, so an Almanac integration would need an attach/index/garden mode rather than the normal repo-local Build flow.

The personal-brain product discussion exposed a second boundary. Superpaper's note-first model can become messy when raw documents, extracted text, generated summaries, agent scratchpads, people pages, and durable synthesis all share the same graph. A generalized brain should preserve originals as source objects, maintain pages as synthesis, and surface conflicts or review tasks separately. That source/synthesis/task split is closer to [[company-brain]] and CodeAlmanac than to a single Obsidian vault where every artifact becomes a note.

## What Almanac should borrow

Superpaper's most portable contribution is operating discipline, not schema. [[operation-prompts]] should eventually absorb its neighborhood-retrieval rule: search lexically, follow outgoing links and backlinks, inspect nearby topics or categories, include recent and temporal context when relevant, and write back only when the result is durable.

The second portable contribution is the living charter. `.almanac/README.md` already acts as the local wiki charter; Build and Garden should update it when wiki conventions, notability rules, or topic doctrine change.

The third portable contribution is visible topic navigation. Almanac topics should remain lightweight classification, but dense or important topics need hub pages that act like Superpaper category pages: they explain what to read first, what each nearby page means, and which pages are current synthesis versus supporting context.

The fourth portable contribution is respect for existing knowledge systems. Almanac should synthesize from human docs and source notes without casually rewriting them, and it should avoid creating a duplicate graph when a folder already has a mature wiki protocol.

## What Almanac should not copy

Almanac should not copy Superpaper's required note types, atomic-first transclusion model, Obsidian-only assumptions, or intense frontmatter schema into codebase wikis. Those choices fit a personal knowledge workspace. They would make codebase memory heavier and would weaken Almanac's existing advantages: file-aware retrieval, flat canonical pages, topic DAGs, repo-local capture, and Git-reviewable markdown.
