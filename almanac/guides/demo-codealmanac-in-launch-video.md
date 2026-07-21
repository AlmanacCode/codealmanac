---
title: Demo CodeAlmanac In A Launch Video
topics: [guides, product, viewer, cli]
sources:
  - id: public-readme
    type: file
    path: README.md
    note: Public product positioning, viewer command, and agent read commands.
  - id: launch-positioning
    type: wiki
    path: product/positioning
    note: Product contrast and demo framing for CodeAlmanac.
  - id: local-viewer
    type: wiki
    path: architecture/viewer/local-viewer
    note: Architecture page for the read-only browser viewer.
  - id: public-command-surface
    type: wiki
    path: reference/cli/public-command-surface
    note: Reference page for the user-facing CLI commands.
  - id: verify-guide
    type: wiki
    path: guides/verify-a-wiki-change
    note: Guide for checking that wiki pages can be found and read through the public surface.
---

# Demo CodeAlmanac In A Launch Video

Use this guide when recording a short launch or product demo for CodeAlmanac. A
good demo shows the repo-owned wiki as the artifact, then shows the CLI
retrieving the same maintained knowledge an agent would use before coding. That
matches the product distinction in [Product positioning](../product/positioning):
CodeAlmanac is not a chat router or generic documentation pitch; it is a local
wiki for decisions, invariants, gotchas, flows, and operating knowledge that
future agent sessions should not have to rediscover [@launch-positioning]
[@public-readme].

Keep the sequence short. The viewer establishes the noun, and the terminal
demonstrates the verb: `codealmanac serve` shows the browsable wiki, while
`codealmanac search` and `codealmanac show` retrieve individual pages through
the public read surface [@local-viewer] [@public-command-surface].

## Choose The Repository

Use a real repository wiki with one page that makes the product obvious to a
cold viewer. The best page explains a decision, invariant, gotcha, incident, or
multi-file flow that would be expensive for a future agent to infer from raw
source alone [@public-readme].

This repository can work when the chosen page is concrete enough. Good
candidates include [local-only product boundaries](../decisions/local-only-python-product),
[page identity](../architecture/wiki/page-identity),
[run queues](../architecture/lifecycle/run-queue-and-sync), or
[mutation safety](../architecture/lifecycle/mutation-safety), because each one
records a constraint that changes how future work should be done.

## Recording Sequence

1. Open `codealmanac serve` to establish that the artifact is a browsable,
   repo-owned Markdown wiki.
2. Show one page containing a decision, invariant, gotcha, or multi-file flow.
3. Run `codealmanac search` and `codealmanac show` to retrieve the same durable
   knowledge as an agent would before coding.

Avoid a folder tour or implementation explanation before the query. The payoff
is not the Markdown tree by itself; it is that a future coding agent can ask for
maintained project understanding and receive a cited page before making a
change [@public-readme].

## Verify Before Recording

Before recording, run the normal wiki verification path for the chosen
repository. `codealmanac validate` checks the graph and source citations, while
`codealmanac search`, `codealmanac show`, and `codealmanac topics` confirm the
page can be found and read through the same public surface the demo will show
[@verify-guide].

See [Product positioning](../product/positioning) for the broader product
distinction.
