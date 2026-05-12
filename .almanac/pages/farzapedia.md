---
title: Farzapedia
topics: [agents, decisions]
sources:
  - docs/research/farzapedia.md
status: active
verified: 2026-05-10
---

# Farzapedia

Farzapedia is a personal knowledge wiki system delivered as an AI skill prompt. The prompt is dropped into `.claude/skills/wiki/SKILL.md` and exposes slash commands (`/wiki ingest`, `/wiki absorb`, `/wiki query`, `/wiki cleanup`, `/wiki breakdown`, `/wiki status`) that compile personal data — Day One journals, Apple Notes, iMessage exports, Obsidian vaults, email, Twitter archives, CSV — into a structured wiki. The system lives at [[docs/research/farzapedia.md]] in this repo.

The relevance to [[wiki-lifecycle-operations]] is domain adjacency: both are AI-maintained wikis over a corpus, both use the [[wikilink-syntax]], both treat synthesis as superior to summarizing. The architectures diverge in three areas: organization model, index storage, and absorb loop design. The writing anti-pattern vocabulary is the most directly portable contribution to [[operation-prompts]].

## Architecture contrasts

**Organization model.** Farzapedia organizes pages in a directory taxonomy (`people/`, `projects/`, `places/`, `philosophies/`, `patterns/`, `tensions/`, `eras/`, `decisions/`, and many others). Directories emerge from the data; the system provides a reference taxonomy to converge toward. Almanac uses a flat `pages/` directory plus a multi-parent topic DAG in `.almanac/topics.yaml`. The topic DAG decouples classification from storage, so a page can belong to multiple overlapping clusters without being duplicated in a folder hierarchy.

**Index storage.** Farzapedia maintains `_index.md` (a master article index with aliases) and `_backlinks.json` (a reverse-link map) as hand-maintained JSON/markdown files that get rebuilt at periodic checkpoints. Almanac uses [[sqlite-indexer]], which rebuilds from `pages/*.md` mtimes before every query command, silently and implicitly.

**Absorb loop.** Farzapedia's `/wiki absorb` processes raw entries chronologically, one at a time, re-reading `_index.md` before each entry and re-reading every article before updating it. Every 15 entries it stops for a checkpoint: rebuild the index, audit new article count, do a quality pass on the three most-updated articles. Almanac's [[wiki-lifecycle-operations]] Absorb is open-scope: the agent reads the context, explores the wiki freely, and makes proportional changes. There is no entry-level loop, no checkpoint interval, and no required article re-read sequence — the prompt relies on agent judgment rather than a traversal protocol.

**Ingest vs. capture.** Farzapedia's `/wiki ingest` is mechanical: a Python script with no LLM, converting source formats into one `.md` file per logical entry under `raw/entries/`. Almanac's [[capture-flow]] (`almanac capture`) is AI-powered, reading a session transcript and calling Absorb to distill project understanding directly into wiki pages. There is no intermediate raw entry layer.

**Domain.** Farzapedia's subject is one person's life: relationships, places, patterns of thinking, creative philosophy, recovery arcs. Almanac's subject is a codebase: decisions, subsystems, flows, contracts, data models, incidents, gotchas. The notability bar differs because the knowledge types differ.

## Writing anti-patterns

Farzapedia names a concrete set of prohibited prose patterns. The list is more specific than Almanac's current style guidance in [[operation-prompts]] (`syntax.md`), which names only broad categories ("marketing prose", "vague claims").

**Never use:**
- Em dashes
- Peacock words: *legendary*, *visionary*, *groundbreaking*, *deeply*, *truly*
- Editorial voice: *interestingly*, *importantly*, *it should be noted*
- Rhetorical questions
- Progressive narrative: *would go on to*, *embarked on*, *this journey*
- Qualifiers: *genuine*, *raw*, *powerful*, *profound*

**Use instead:**
- Attribution over assertion: "He described it as energizing" not "It was energizing"
- One claim per sentence. Short sentences.
- Simple past or present tense
- Dates and specifics in place of adjectives
- Direct quotes to carry emotional weight; the surrounding article stays neutral

The tone target Farzapedia names is "Wikipedia, not AI." The article is neutral. Quotes do the feeling. `syntax.md` targets the same direction ("direct, factual, dense") but the prohibited-phrase list is a sharper enforcement tool for Absorb and Garden prompts.

## Anti-cramming and anti-thinning

Farzapedia names two opposing absorb failure modes by name.

**Anti-cramming:** The gravitational pull of existing articles causes agents to append to a large article rather than create a new one. If a third paragraph about a sub-topic appears in an existing article, that sub-topic probably deserves its own page. A wiki with five bloated articles instead of thirty focused ones has cramped.

**Anti-thinning:** Creating a page is not the win. A stub with three vague sentences when four other entries also mentioned that topic is a failure. Every time a page is touched, it should get richer. Forty stubs is as bad as five bloated articles.

The same tension exists in Almanac's Absorb. The current `absorb.md` prompt says "prefer updating existing evolving pages over creating new pages" (resists cramming) and "create a new page only when the input reveals a durable concept that needs its own anchor" (resists thinning). Farzapedia's named pair is a more memorable framing for the same constraint.

## What aligns

Farzapedia's "writer not clerk" framing matches Almanac's "inputs are raw material, not outputs." Both prioritize synthesis over logging. Both explicitly prohibit the wiki becoming a diary, transcript store, or progress log. Both treat concept articles — patterns, themes, cross-cutting ideas — as first-class rather than as overflow.

The checkpoint pattern (every 15 entries: audit new article count, re-read three articles, check for event-log structure) has no direct counterpart in Almanac, but it names a real quality risk: after many absorb passes, some pages will have drifted into chronological dumps. That is the Garden operation's job.
