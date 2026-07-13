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
  - id: wiki-usefulness-evaluation
    type: wiki
    path: concepts/wiki-usefulness-evaluation
    note: Concept page for evaluating whether the wiki improves agent work.
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
[@page-graph]. Why concept, guide, decision, and reference vocabulary exists
today without being a validated frontmatter field is a product decision; see
[No page-kind field](../decisions/no-page-kind-field).

[Wiki usefulness evaluation](wiki-usefulness-evaluation) defines the product
standard for judging whether the wiki helps agents complete real codebase work,
instead of only scoring page cleanliness or graph shape [@wiki-usefulness-evaluation].

## Lifecycle And Inputs

[Lifecycle operation](lifecycle-operation) defines build, ingest, and garden as
the page-writing operation family [@lifecycle-operation]. [Source material](source-material)
defines the raw input selected for ingest and keeps that input separate from
page `sources:` evidence [@source-material].

[Run ledger](run-ledger) explains the durable records, queued specs, events,
worker locks, and `codealmanac jobs` inspection surface used by lifecycle work
[@run-ledger].

Product-story and launch-demo framing is not a concept: it lives in
[Demo CodeAlmanac in a launch video](../guides/demo-codealmanac-in-launch-video)
in `guides/`, since it is task-oriented copy for a specific piece of work
rather than vocabulary this repo's code depends on.
