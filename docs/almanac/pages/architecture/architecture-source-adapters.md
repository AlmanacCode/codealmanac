---
page_id: architecture-source-adapters
title: Source Adapters
summary: Source adapters inspect filesystem, Git, GitHub, transcript, and web sources behind a common runtime contract.
topics: [architecture, integration]
sources:
  - id: source-init
    type: file
    path: src/codealmanac/integrations/sources/__init__.py
  - id: filesystem-adapter
    type: file
    path: src/codealmanac/integrations/sources/filesystem/adapter.py
  - id: git-adapter
    type: file
    path: src/codealmanac/integrations/sources/git/adapter.py
  - id: github-adapter
    type: file
    path: src/codealmanac/integrations/sources/github/adapter.py
  - id: transcript-runtime
    type: file
    path: src/codealmanac/integrations/sources/transcripts/runtime.py
  - id: web-adapter
    type: file
    path: src/codealmanac/integrations/sources/web/adapter.py
---

# Source Adapters

Source adapters are integration-edge modules that inspect concrete source types behind the common source runtime contract. The default adapter set covers filesystem paths, Git ranges and diffs, GitHub issues and pull requests, local transcripts, and web pages. [@source-init] [@filesystem-adapter] [@git-adapter] [@github-adapter] [@transcript-runtime] [@web-adapter]

## Why are adapters under integrations?

Source inspection talks to the filesystem, Git, GitHub CLI, transcript stores, and HTTP. Keeping that code under integrations keeps outside-world mechanics out of services and workflows.

## What should a new adapter provide?

A runtime adapter should say whether it supports a `SourceRef` and return a `SourceRuntime` snapshot when asked to inspect that ref. [@source-init]

## What guide covers adding one?

Use `[[guide-add-source-adapter]]`.

