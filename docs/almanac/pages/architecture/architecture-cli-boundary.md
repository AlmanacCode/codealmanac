---
page_id: architecture-cli-boundary
title: CLI Boundary
summary: The CLI is split into parser, dispatch, and render modules so command syntax, request construction, and terminal output can change separately.
topics: [architecture]
sources:
  - id: parser-root
    type: file
    path: src/codealmanac/cli/parser/root.py
  - id: dispatch-root
    type: file
    path: src/codealmanac/cli/dispatch/root.py
  - id: live-agreement
    type: file
    path: docs/python-port-live-agreement.md
  - id: architecture-tests
    type: file
    path: tests/test_architecture.py
---

# CLI Boundary

The CLI boundary separates command parsing, workflow dispatch, and terminal rendering. The root parser groups lifecycle, wiki, and admin commands; dispatch modules build request objects and call services or workflows; render modules own user-facing text and Rich output. [@parser-root] [@dispatch-root] [@live-agreement]

## Why split the CLI this way?

The split keeps command syntax from absorbing product logic and keeps terminal formatting out of services. Architecture tests enforce that Rich terminal UI stays inside the CLI render edge. [@architecture-tests]

## What command families exist?

Lifecycle commands include `init`, `build`, `ingest`, `garden`, `sync`, and the hidden worker command. Wiki commands include `list`, `search`, `show`, `topics`, `health`, `reindex`, `serve`, `tag`, and `untag`. Admin commands include setup, uninstall, doctor, update, jobs, and automation. [@parser-root]

## What should I read next?

Use `[[reference-cli-commands]]` for exact commands and `[[guide-add-cli-command]]` for the maintainer task.

