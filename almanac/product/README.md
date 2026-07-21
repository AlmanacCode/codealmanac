---
title: Product Surface
topics: [product, overview]
sources:
  - id: topics
    type: file
    path: almanac/topics.yaml
    note: Topic graph entry that defines the product neighborhood.
  - id: local-only
    type: wiki
    path: decisions/local-only-python-product
    note: Decision that defines the local Python product boundary.
  - id: release
    type: wiki
    path: guides/release-package
    note: Guide for publishing and smoke-testing the Python package.
  - id: positioning
    type: wiki
    path: product/positioning
    note: Product page for launch messaging and comparison framing.
  - id: launch-metrics
    type: wiki
    path: product/launch-metrics
    note: Product page for interpreting launch traction metrics.
  - id: evaluation
    type: wiki
    path: product/evaluation-benchmarks
    note: Product page for benchmark and evaluation strategy.
  - id: launch-demo
    type: wiki
    path: guides/demo-codealmanac-in-launch-video
    note: Guide for demonstrating CodeAlmanac through the viewer and CLI.
  - id: comparison-guide
    type: wiki
    path: guides/compare-codealmanac-with-generated-wikis
    note: Guide for comparing CodeAlmanac with generated repository wikis.
---

# Product Surface

The product surface is the public shape CodeAlmanac presents outside its
implementation internals. The topic graph defines `product` as product scope and
public-surface decisions, and this hub routes that neighborhood: the local-only
boundary, the package release path, positioning, launch metrics, demos, and
evaluation strategy [@topics].

The base decision is [Local-only Python product](../decisions/local-only-python-product).
It states that the active product is the `codealmanac` Python CLI, a repo-local
`almanac/` tree, local runtime state under `~/.codealmanac/`, and local agent
harnesses for lifecycle work [@local-only]. Read that decision before changing
public commands, setup language, install instructions, hosted terminology, or
compatibility behavior.

For package work, use [Release package](../guides/release-package). That guide
is the release checklist for proving the installed `codealmanac` command works
from clean Python environments and that packaged prompts, manuals, and CLI
resources ship with the distribution [@release].

For launch work, start with [Product positioning](positioning). It preserves the
product contrast: CodeAlmanac is a maintained repository wiki for decisions,
invariants, gotchas, flows, and operating knowledge, not a team-chat router or
generic documentation pitch [@positioning].

[Launch metrics](launch-metrics) keeps PyPI fetches separate from user counts,
while [Evaluation benchmarks](evaluation-benchmarks) turns the positioning claim
into benchmark tasks for repo-only docs, living-memory updates, and practical
agent work [@launch-metrics] [@evaluation]. [Demo CodeAlmanac in a launch
video](../guides/demo-codealmanac-in-launch-video) and [Compare CodeAlmanac with
generated wikis](../guides/compare-codealmanac-with-generated-wikis) turn the
same framing into a short viewer-plus-CLI recording sequence and a side-by-side
benchmark procedure [@launch-demo] [@comparison-guide].
