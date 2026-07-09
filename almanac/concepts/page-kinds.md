---
title: Page Kinds
topics: [concepts, wiki, page-format, product]
sources:
  - id: dita-research
    type: file
    path: docs/research/2026-07-08-dita-and-codealmanac.md
    note: Research note mapping DITA concepts such as information typing, specialization, maps, profiles, and chunking to CodeAlmanac.
  - id: frontmatter-parser
    type: file
    path: src/codealmanac/services/wiki/frontmatter.py
    note: Current parsed frontmatter fields and extra-key behavior.
  - id: page-models
    type: file
    path: src/codealmanac/services/wiki/models.py
    note: Parsed frontmatter and page document models.
  - id: frontmatter-reference
    type: wiki
    path: reference/page-format/frontmatter-and-sources
    note: Maintained reference for supported frontmatter and sources.
  - id: dita-types-transcript
    type: conversation
    path: /Users/rohan/.codex/sessions/2026/07/08/rollout-2026-07-08T17-57-38-019f4461-595d-7c30-8134-b4f353d7ce3e.jsonl
    note: Discussion that summarized DITA's concept, task, reference, glossary, troubleshooting, and map types for CodeAlmanac.
---

# Page Kinds

Page kinds are a possible future content contract for CodeAlmanac pages. The DITA research note maps DITA information typing to CodeAlmanac categories such as decision, concept, guide, workflow, gotcha, and reference, but the current parser does not model a `kind` field today [@dita-research] [@frontmatter-parser]. This means page kinds are product vocabulary and design prior art, not current runtime behavior.

The useful distinction is the reader question each page answers. A concept explains what something is and why it matters; a task or guide tells the reader how to do work; a reference gives exact lookup facts; troubleshooting records a symptom, cause, and fix; a map organizes related pages rather than acting as a normal prose page [@dita-types-transcript]. CodeAlmanac already expresses some of this through folders such as `concepts/`, `guides/`, `reference/`, and `decisions/`, but those folders are path conventions rather than validated page-type contracts [@dita-research].

## Current Contract

The modeled frontmatter fields are `title`, `summary`, `topics`, and `sources`; `FrontmatterFields` ignores extra keys instead of storing them on `ParsedFrontmatter` [@frontmatter-parser] [@page-models]. The maintained [Frontmatter and sources](../reference/page-format/frontmatter-and-sources) reference documents the same contract and does not list `kind` as a supported field [@frontmatter-reference].

That boundary matters for future work. Adding page kinds would require parser, validation, prompt, and viewer changes; it should not happen as a hidden docs convention or by casually adding `kind:` to pages [@dita-research] [@frontmatter-parser].

## DITA Lessons

DITA is useful here as content architecture prior art, not as an implementation stack. The research note recommends borrowing vocabulary such as page types, maps, source/evidence distinctions, and processing profiles while avoiding DITA syntax, DITA-OT, XML schemas, conref, and metadata cascade for the local-first Markdown product [@dita-research].

The strongest borrowed idea is lightweight specialization. A future `decision`, `guide`, `reference`, or `gotcha` kind could be a constrained form of the general page contract, with validation and prompts checking only the structure that the product actually uses [@dita-research]. The risk is over-validating prose or duplicating folder structure with a field that becomes stale [@dita-research].

## Product Fit

Page kinds become worthwhile only if they change behavior. Good reasons include kind-specific validation, filtered viewer modes, better prompt instructions, or export profiles that assemble atomic pages into human-readable packets [@dita-research]. Without one of those behaviors, the current folder and topic system is simpler and more readable.

Viewer or export profiles are the safest adjacent idea. The research note maps DITA chunking and viewing profiles to CodeAlmanac's local viewer: pages can stay atomic for agents while a viewer or export command presents larger guides, onboarding paths, or debug views [@dita-research]. That belongs at the projection boundary rather than inside committed prose until a concrete reader workflow requires it.
