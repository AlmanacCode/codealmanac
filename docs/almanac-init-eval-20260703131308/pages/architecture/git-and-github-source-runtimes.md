---
title: Git And GitHub Source Runtimes
topics: [architecture, sources, integrations]
sources:
  - id: git
    type: file
    path: src/codealmanac/integrations/sources/git/adapter.py
  - id: github-client
    type: file
    path: src/codealmanac/integrations/sources/github/client.py
  - id: github-render
    type: file
    path: src/codealmanac/integrations/sources/github/rendering.py
  - id: tests
    type: file
    path: tests/test_github_source_runtime.py
---

# Git And GitHub Source Runtimes

Git and GitHub source runtimes load change context without making lifecycle workflows provider-specific. The Git adapter renders revision ranges with log, diff stat, and diff text, and renders working-tree diffs through `git status`, unstaged diff, staged diff, or a target ref [@git].

The GitHub runtime uses the `gh` CLI through a client module, validates typed PR/issue payloads, fetches PR diffs, and renders metadata, files, commits, comments, reviews, labels, and actors for prompt material [@github-client] [@github-render].

Both adapters sit behind [[source-resolution-and-runtimes]]. Exact user-facing address forms are listed in [[source-address-syntax-reference]].
