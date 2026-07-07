---
title: Add A CLI Command
topics: [guides, cli]
sources:
  - id: parser-root
    type: file
    path: src/codealmanac/cli/parser/root.py
    note: Root parser and public command registration.
  - id: dispatch-root
    type: file
    path: src/codealmanac/cli/dispatch/root.py
    note: Root CLI dispatcher and command-family routing.
  - id: render-root
    type: file
    path: src/codealmanac/cli/render/root.py
    note: Render facade used by dispatchers.
  - id: architecture-tests
    type: file
    path: tests/test_architecture.py
    note: Architecture tests that protect CLI, service, render, and dependency boundaries.
---

# Add A CLI Command

Use this guide when adding a public `codealmanac` command or subcommand. The CLI is an adapter: parser modules define syntax, dispatch modules build typed requests and call the app, render modules own terminal and JSON output, and services or workflows own product behavior [@parser-root] [@dispatch-root] [@render-root]. Do not put core behavior in argparse handlers.

The successful outcome is a command that appears in the public parser, routes through the right command family, calls a service or workflow through request models, renders through the CLI render edge, and keeps the architecture tests passing. See [CLI adapter boundary](../architecture/cli/adapter-boundary), [Request models](../architecture/request-models), and [Public command surface](../reference/cli/public-command-surface).

## Choose The Owning Command Family

First decide whether the command belongs to an existing family. Wiki read and organization commands live under `cli/parser/wiki.py` and `cli/dispatch/wiki.py`. Admin commands such as setup, config, jobs, automation, doctor, and update are registered through the admin parser and dispatcher. Lifecycle commands are registered through the run-command parser [@parser-root] [@dispatch-root].

If the command is a new top-level public command, add it to the root parser's public command metavar so help output shows the full command surface [@parser-root]. If it is a new family, add an `is_*_command` check and route in `cli/dispatch/root.py`; if it fits an existing family, update that family dispatcher instead [@dispatch-root].

## Add Parser Syntax

Put argparse definitions in the parser module for the chosen family. Keep this layer to names, arguments, flags, choices, help text, and JSON switches. `build_parser()` only creates the root parser, installs `--version`, creates subparsers, and calls family registration functions [@parser-root].

Avoid service imports in parser files. A parser should not know how the command works. It should only produce an `argparse.Namespace` that dispatch can translate.

## Add Request And Service Behavior

Create or extend a typed request model near the service or workflow that owns the action. Dispatch should build that request from `args`, then call the composed `CodeAlmanac` app. This keeps future callers free to use services directly instead of shelling through the CLI.

If the command needs new product behavior, implement it in the owning service or workflow. The architecture tests enforce important ownership rules, including that CLI, workflows, and services do not import integrations directly, config owns TOML and Pydantic settings, and Rich stays in the CLI render edge [@architecture-tests].

## Add Dispatch

In the family dispatcher, add one branch for the new command or subcommand. Follow the existing pattern: build a request, call `app.<service>.<method>(request)`, render the result, and return an integer exit code.

Root dispatch stays a command-family router. It delegates to run, wiki, or admin dispatchers and raises an assertion for unknown commands [@dispatch-root]. Do not make root dispatch understand an individual command's request model.

## Add Rendering

Put human and JSON output in the relevant render module. `cli/render/root.py` is a facade that re-exports render functions for stable imports; it does not render output itself [@render-root].

When the command supports `--json`, use the existing render helpers for shaped models or rows. Human output is behavior too, so keep wording stable and add tests when output shape matters.

## Test The Boundary

At minimum, run the targeted tests for the command and the architecture guardrails:

```bash
uv run pytest tests/test_architecture.py
uv run ruff check .
```

Broaden the test run when the command touches shared services, lifecycle workflows, config, index behavior, or filesystem writes. `tests/test_architecture.py` exists to catch command additions that collapse parser, dispatch, render, service, and integration responsibilities into the wrong layer [@architecture-tests].
