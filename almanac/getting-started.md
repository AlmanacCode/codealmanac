---
title: Getting Started
summary: First reading path for agents working in CodeAlmanac.
topics: [architecture, operations, wiki-design]
sources:
  - id: wiki-readme
    type: file
    path: almanac/README.md
    note: Top-level wiki reading path and notability bar.
  - id: manual
    type: file
    path: MANUAL.md
    note: Repo build rules and product constraints.
---

# Getting Started

Use this page as the first route into the CodeAlmanac wiki. CodeAlmanac is the
local-first Python CLI that keeps repo wiki source in `almanac/` and user-level
state in `~/.codealmanac/`; this wiki preserves the decisions, flows,
invariants, and operating notes future agents need before changing the product
[@wiki-readme] [@manual].

## Read First

Start with [CodeAlmanac Wiki](README) for the current product contract and
notability bar. Before feature work, read `MANUAL.md` and the [Style](style)
pages because this repo treats architecture reshaping as part of implementation
[@manual].

## Common Routes

- Product scope: [Local-First Python](decisions/local-first-python).
- Wiki source shape: [Wiki Tree](architecture/wiki-tree).
- Search behavior: [Indexing](architecture/indexing).
- Operation execution: [Runs](architecture/runs).
- Codex and Claude execution: [Providers](architecture/providers).
- Transcript intake and scheduling: [Sync And Automation](architecture/sync-and-automation).
- Day-to-day coding: [Working On CodeAlmanac](guides/working-on-codealmanac).
- Migrated historical context: [Legacy Almanac Migration](reference/legacy-almanac-migration).
