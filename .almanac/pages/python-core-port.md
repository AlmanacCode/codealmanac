---
title: Python Core Port
summary: The sibling `../almanac` repository is the active Python port for general Almanac concepts, while this repo remains the older TypeScript codebase-wiki package.
topics: [systems, decisions, product-positioning]
sources:
  - id: state-comparison-session
    type: conversation
    path: /Users/rohan/.codex/sessions/2026/06/22/rollout-2026-06-22T15-50-06-019ef186-d8dd-7d92-b5c9-b39e4468c891.jsonl
    note: Records the direct comparison among this TypeScript repo, the archived TypeScript shell under ../almanac/old, and the active Python port under ../almanac/src/almanac.
  - id: runtime-choice
    type: wiki
    slug: typescript-runtime-choice
    note: Explains the earlier TypeScript runtime decision that this page narrows.
  - id: product-family
    type: wiki
    slug: almanac-product-family
    note: Explains the broader Almanac product model that the Python port now implements more directly.
status: active
verified: 2026-06-23
---

# Python Core Port

The sibling repository at `/Users/rohan/Desktop/Projects/almanac` is the active Python port for general Almanac work. This `codealmanac` repository remains a TypeScript, npm-installed codebase-wiki implementation, but it is no longer the best source for the newest general-Almanac concepts such as bundled manual sync, durable source catalogs, source-backed ingest, run-ledger services, server APIs, and the React/Vite viewer. [@state-comparison-session]

## Current Relationship

`[[typescript-runtime-choice]]` records why this repo stayed TypeScript in the earlier codebase-wiki phase. That decision still describes this repo's local package shape, but it should not be read as a claim that all Almanac work remains TypeScript-first. The active Python port lives under `../almanac/src/almanac/`, uses `uv`, exposes `almanac.cli.main:main`, ships package data from `manual/*.md`, `prompts/base/*.md`, `prompts/operations/*.md`, and `skills/*`, and treats `viewer/` as a separate React/Vite app over the Python server API. [@state-comparison-session] [@runtime-choice]

This repo has the concepts in partial or older form: root `MANUAL.md`, operation prompts, `absorb`, an `ingest` alias, local capture, the SQLite indexer, and a local viewer. It does not have the full newer Python shape: `manual sync`, `sources`, source-backed `ingest`, service-owned runs, source provenance routes, automation capture-transcripts, the Python ASGI server, or the current source-library workflow. [@state-comparison-session]

## Archived TypeScript Shell

`../almanac/old` is the archived TypeScript general-Almanac shell. It had more of the general-source model than this repo: bundled manual files, source skills, `almanac manual`, `almanac sources`, and a real ingest operation over `wiki/` and `sources/`. It is historical context for concepts that later moved into the Python port, not the current implementation to extend first. [@state-comparison-session]

## How To Use This

When changing this repo's local CLI, indexer, capture flow, provider harness, or `.almanac/` codebase-wiki behavior, trust the current TypeScript code in this checkout. When asking whether CodeAlmanac is missing newer manual, source, run, server, or viewer concepts, compare against `/Users/rohan/Desktop/Projects/almanac/src/almanac/` before designing from this repo alone. [@state-comparison-session]

The project-level product model remains [[almanac-product-family|Almanac as a maintained project knowledge layer]]. The Python port is the newer implementation direction for the general source-grounded product, while this repo preserves the older local codebase-wiki package and its accumulated design history. [@product-family] [@state-comparison-session]
