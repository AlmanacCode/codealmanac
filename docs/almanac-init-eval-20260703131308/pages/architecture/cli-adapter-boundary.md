---
title: CLI Adapter Boundary
topics: [architecture, cli]
sources:
  - id: main
    type: file
    path: src/codealmanac/cli/main.py
  - id: parser
    type: file
    path: src/codealmanac/cli/parser/root.py
  - id: dispatch
    type: file
    path: src/codealmanac/cli/dispatch/root.py
  - id: agreement
    type: file
    path: docs/python-port-live-agreement.md
---

# CLI Adapter Boundary

The CLI is an adapter over the app graph. `main()` builds an argparse parser, catches product and Pydantic validation errors, creates the app, and delegates to dispatch [@main].

The edge is split into parser, dispatch, and render modules by command family. Parser modules define public flags, dispatch modules build request objects and call services/workflows, and render modules own text or JSON output [@parser] [@dispatch]. The live agreement calls this split out for wiki, lifecycle, admin, setup, topics, and render families [@agreement].

Use [[cli-command-surface-reference]] for exact commands. When adding behavior, put business rules in services or workflows and keep the CLI as request construction plus presentation.
