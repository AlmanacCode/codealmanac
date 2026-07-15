---
title: CLI Architecture
topics: [architecture, cli, overview]
sources:
  - id: adapter-boundary
    type: wiki
    path: architecture/cli/adapter-boundary
    note: Architecture page for parser, dispatch, and render ownership.
  - id: terminal-output
    type: wiki
    path: architecture/cli/terminal-output
    note: Architecture page for human and JSON terminal rendering.
  - id: public-command-surface
    type: wiki
    path: reference/cli/public-command-surface
    note: Reference page for public commands, hidden worker commands, and absent legacy surface.
  - id: json-output
    type: wiki
    path: reference/cli/json-output-contract
    note: Reference page for command JSON output behavior.
  - id: error-exit
    type: wiki
    path: reference/cli/error-and-exit-code-contract
    note: Reference page for CLI error messages and exit codes.
  - id: add-command
    type: wiki
    path: guides/add-a-cli-command
    note: Guide for adding a public command or subcommand through the CLI adapter boundary.
---

# CLI Architecture

CLI architecture is the terminal edge of CodeAlmanac. It owns command syntax,
argument-to-request translation, exit codes, and rendered output, while product
behavior stays in services and workflows assembled by the application
composition root [@adapter-boundary]. Read this hub before changing visible
commands, command-family routing, terminal text, JSON output, or error
behavior.

The CLI topic is intentionally split between architecture, reference, and guide
pages. Architecture explains where responsibilities live, reference pages define
the exact public contract, and the guide gives the safe change path for new
commands.

## Reading Order

Start with [CLI adapter boundary](adapter-boundary). It explains the parser,
dispatch, and render split, and why the CLI is an adapter rather than the
internal API [@adapter-boundary].

Then read [Terminal output](terminal-output) when a change affects human output,
JSON rendering, color, syntax errors, or command status text [@terminal-output].

Use [Public command surface](../../reference/cli/public-command-surface) for
the exact visible commands, options, hidden worker entries, and intentionally
absent legacy surface [@public-command-surface]. Pair it with [JSON output
contract](../../reference/cli/json-output-contract) for machine-readable output
and [Error and exit code contract](../../reference/cli/error-and-exit-code-contract)
for failure rendering [@json-output] [@error-exit].

## Change Path

When adding or reshaping a command, follow [Add a CLI command](../../guides/add-a-cli-command).
That guide keeps syntax in the parser family, request construction in dispatch,
output in render modules, and product behavior in the owning service or
workflow [@add-command].
