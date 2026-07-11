---
title: Getting Started
topics: [wiki, overview]
sources:
  - id: repo-readme
    type: file
    path: README.md
    note: Public quickstart, command surface, lifecycle overview, and state layout.
  - id: manual
    type: file
    path: MANUAL.md
    note: Repo engineering rules and local CodeAlmanac constraints.
  - id: live-agreement
    type: file
    path: docs/python-port-live-agreement.md
    note: Current Python rewrite agreement and active decisions.
---

# Getting Started

Getting started is the routing page for this CodeAlmanac wiki. It gives future agents the shortest useful path through the repo knowledge: first understand the local wiki model, then the lifecycle workflows that write pages, then the index and search surface that make the wiki usable day to day. The goal is not to read every page first; it is to build the right mental map before changing the system.

CodeAlmanac is a local Python product in this rewrite. It stores committed wiki pages under `almanac/`, keeps derived runtime state under `~/.codealmanac/`, and avoids hosted login, upload, SDK, and cloud capture surfaces in v1 [@live-agreement]. The public README describes the same split for users: Markdown pages live in the repo, while indexes, runs, events, locks, and sync state live outside the repo [@repo-readme].

## First Reading Path

Read these pages in order:

1. [Local repo wiki](concepts/local-repo-wiki) explains what the repo wiki is and why committed Markdown is separate from local derived state.
2. [Lifecycle workflows](architecture/lifecycle/workflows) explains build, ingest, and garden, and why sync is only a scanner.
3. [Index refresh and search](architecture/wiki/index-refresh-and-search) explains how read commands use the derived index.
4. [Verify a wiki change](guides/verify-a-wiki-change) explains how to check a wiki edit before calling it done.

That route matches the main working loop in this repository: write durable Markdown, let local services derive searchable state, and validate the result before handing work back.

## If You Are Changing Code

Start with the manual rule: evolve the codebase so the feature fits, then build the feature [@manual]. This repo treats architecture as living structure. When the current shape does not hold a feature cleanly, the expected move is to stop and flag the mismatch instead of bolting on a local workaround [@manual].

For most implementation work, follow the architecture pages before opening individual modules. [Architecture](architecture/) gives the reading order for the architecture cluster. [Service boundaries](architecture/service-boundaries) explains the dependency direction from CLI adapters into the app, workflows, services, stores, ports, and integrations. [Lifecycle workflows](architecture/lifecycle/workflows) is the entry point for page-writing operations. [Source resolution and runtime](architecture/sources/source-resolution-and-runtime) is the entry point for ingest inputs.

## If You Are Changing The Wiki

Use the wiki as source-controlled product knowledge. Pages should preserve durable context that future agents would otherwise rediscover, not routine activity logs or raw notes [@repo-readme] [@manual].

Before editing pages, read the relevant manual files under `src/codealmanac/manual/`. The writing manuals define leads, evidence, links, topics, and page-type shapes. After editing, run the repo's normal validation path for wiki changes; the public read surface includes `codealmanac health` and `codealmanac validate` [@repo-readme].

## Common Work Areas

Use these routes when you already know the kind of work:

- For command behavior, read [CLI public command surface](reference/cli/public-command-surface).
- For config defaults, model choices, and precedence, read [Config keys](reference/config-keys).
- For page identity, routes, and `README.md` landing pages, read [Page identity](architecture/wiki/page-identity).
- For page evidence and frontmatter, read [Frontmatter and sources](reference/page-format/frontmatter-and-sources).
- For lifecycle run state, logs, and attach behavior, read [Run states and events](reference/runs/run-states-and-events).
- For the local browser UI, read [Local viewer](architecture/viewer/local-viewer).
- For launch-video or product-demo framing, read [Demo CodeAlmanac in a launch video](guides/demo-codealmanac-in-launch-video).
