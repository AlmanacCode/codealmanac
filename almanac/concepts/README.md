---
title: Concepts
topics: [concepts, overview]
sources:
  - id: topics
    type: file
    path: almanac/topics.yaml
    note: Topic graph entry that defines concepts as core vocabulary and mental models.
  - id: local-repo-wiki
    type: wiki
    path: concepts/local-repo-wiki
    note: Concept page for the repo-owned Markdown wiki model.
  - id: lifecycle-operation
    type: wiki
    path: concepts/lifecycle-operation
    note: Concept page for page-writing lifecycle operations.
  - id: source-material
    type: wiki
    path: concepts/source-material
    note: Concept page for ingest input material and page evidence boundaries.
  - id: run-ledger
    type: wiki
    path: concepts/run-ledger
    note: Concept page for durable run records and job inspection.
  - id: page-graph
    type: wiki
    path: concepts/page-graph
    note: Concept page for the derived page, topic, link, source, and health graph.
  - id: page-kinds
    type: wiki
    path: concepts/page-kinds
    note: Concept page for possible future page-kind contracts.
  - id: launch-positioning
    type: wiki
    path: concepts/launch-positioning
    note: Concept page for reusable product launch framing.
---

# Concepts

Concept pages define CodeAlmanac vocabulary that appears across architecture,
guides, decisions, and reference pages. The topic graph defines `concepts` as
the neighborhood for core vocabulary and mental models, and this hub routes
readers to the term that explains the subject before they follow implementation
details [@topics].

Use this page when a term is familiar enough to appear in several places but
specific enough that a future agent should not infer its meaning from raw code.

## Wiki Model

[Local repo wiki](local-repo-wiki) is the starting concept for this repository.
It explains why the committed wiki source is the `almanac/` Markdown tree and
why derived indexes, run records, and scheduler state live under local machine
state instead [@local-repo-wiki].

[Page graph](page-graph) explains the derived model that connects pages,
topics, links, file references, sources, backlinks, and health checks
[@page-graph]. [Future page kinds](page-kinds) explains why concept, guide,
decision, and reference vocabulary exists today without being a validated
frontmatter field [@page-kinds].

## Lifecycle And Inputs

[Lifecycle operation](lifecycle-operation) defines build, ingest, and garden as
the page-writing operation family [@lifecycle-operation]. [Source material](source-material)
defines the raw input selected for ingest and keeps that input separate from
page `sources:` evidence [@source-material].

[Run ledger](run-ledger) explains the durable records, queued specs, events,
worker locks, and `codealmanac jobs` inspection surface used by lifecycle work
[@run-ledger].

## Product Framing

[Launch positioning](launch-positioning) preserves reusable product-story
language for launch and demo work [@launch-positioning]. Read it when changing
copy or demos, not when looking for runtime behavior.
