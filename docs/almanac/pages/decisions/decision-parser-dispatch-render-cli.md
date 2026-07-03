---
page_id: decision-parser-dispatch-render-cli
title: Parser Dispatch Render CLI
summary: CLI code is split so syntax, service calls, and output formatting have separate homes.
topics: [decisions]
sources:
  - id: live-agreement
    type: file
    path: docs/python-port-live-agreement.md
  - id: parser-root
    type: file
    path: src/codealmanac/cli/parser/root.py
  - id: architecture-tests
    type: file
    path: tests/test_architecture.py
---

# Parser Dispatch Render CLI

The CLI follows a parser, dispatch, and render split. Parser modules define command syntax, dispatch modules build requests and call services or workflows, and render modules own terminal output. [@live-agreement] [@parser-root]

## Status

Accepted. [@live-agreement]

## Context

The CLI has lifecycle, wiki, and admin command families. Without a boundary, command flags, workflow request construction, and user-facing text would grow in the same files.

## Decision

We will keep parser construction, dispatch, and rendering in separate CLI modules by command family. [@live-agreement]

## Consequences

New commands need changes in the relevant parser, dispatch, and render areas. Rich output must stay in `cli/render`, which is enforced by architecture tests. [@architecture-tests] See `[[architecture-cli-boundary]]` and `[[guide-add-cli-command]]`.

