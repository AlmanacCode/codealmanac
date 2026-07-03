---
page_id: guide-add-cli-command
title: Add A CLI Command
summary: Use this guide when adding a new public command or subcommand to the Python CLI without breaking the parser, dispatch, and render boundary.
topics: [guides]
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

# Add A CLI Command

Use this guide when a maintainer needs to add a CodeAlmanac command while preserving the CLI boundary. The result should be a parser change for syntax, a dispatch change that builds typed requests and calls services or workflows, and render code only when terminal output changes. [@parser-root] [@dispatch-root] [@live-agreement]

## Preconditions

Decide whether the command is lifecycle, wiki, or admin work. Read `[[architecture-cli-boundary]]` and check `[[reference-cli-commands]]`.

## Steps

1. Add syntax in the parser module for the command family.
2. Add request construction in the matching dispatch module.
3. Call an existing service or workflow when one fits.
4. Add or update render code only for user-facing output.
5. Add tests for parser behavior, dispatch behavior, and any public contract.

## Verification

Run the relevant focused tests, then run `uv run pytest tests/test_architecture.py` because the CLI boundary is guarded there. [@architecture-tests]

## Recovery

If the command needs integration code, stop and add a service-owned port plus an integration adapter. Do not import integrations directly into CLI, services, or workflows. [@architecture-tests]

