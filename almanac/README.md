---
title: CodeAlmanac Wiki
topics: [wiki, overview]
sources:
  - id: repo-readme
    type: file
    path: README.md
    note: Public product overview, commands, and local state description.
  - id: live-agreement
    type: file
    path: docs/python-port-live-agreement.md
    note: Current Python rewrite constraints and local-only decisions.
  - id: kernel-prompt
    type: file
    path: src/codealmanac/prompts/base/kernel.md
    note: Runtime rules for wiki-writing agents.
---

# CodeAlmanac Wiki

The CodeAlmanac wiki is the committed knowledge base for this repository. It is a nested Markdown tree under `almanac/`, written for future coding agents who need the decisions, flows, invariants, and gotchas that code alone does not explain [@repo-readme] [@kernel-prompt]. This wiki routes readers from product concepts to architecture, guides, decisions, and reference pages so they can work in the Python rewrite without rediscovering the same context.

CodeAlmanac is local-first in this version. The repo-owned wiki source lives in `almanac/`, while derived indexes, run records, and scheduler state live under `~/.codealmanac/` [@repo-readme] [@live-agreement]. That split is the main fact to keep in mind when reading the pages here: Markdown is the durable source, local databases are runtime state.

## Start Here

Begin with [Getting started](getting-started). It gives the shortest reading path for future agents and points to the dense clusters that matter first.

The core idea is the [local repo wiki](concepts/local-repo-wiki): a browseable Markdown wiki committed with the code, plus derived local state for search and runs. That concept explains why page identity comes from paths, why `README.md` files are landing pages, and why file evidence belongs in `sources:`.

For implementation work, read [Architecture overview](architecture/) and then [Service boundaries](architecture/service-boundaries). They explain how the CLI, app composition root, workflows, services, stores, ports, and integrations divide responsibility. For command behavior, use [CLI public command surface](reference/cli/public-command-surface). For config defaults and precedence, use [Config keys](reference/config-keys).

## Main Clusters

The wiki is organized by page role, not by source file:

- `concepts/` defines repo-specific vocabulary such as local repo wiki, lifecycle operation, and source material.
- `architecture/` explains ownership, flows, persistence, provider edges, and runtime resources.
- `guides/` gives task-oriented procedures for changing or verifying the wiki.
- `decisions/` records constraints that shape future work.
- `reference/` documents exact contracts, commands, formats, and state shapes.

Topic navigation is the cross-folder route through those pages. Read [Topics DAG](architecture/wiki/topics-dag) for the topic graph, [Topics YAML](reference/topics-yaml) for the file format, and [Maintain topics](guides/maintain-topics) when changing topic assignments or parent links.

## Reading Rule

Use the wiki as maintained synthesis, then verify behavior against current code when the two disagree. The runtime kernel gives the same rule to writing agents: code is authoritative for behavior, Markdown links are the page-link syntax, and file evidence belongs in structured `sources:` entries [@kernel-prompt].
