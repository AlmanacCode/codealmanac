---
title: Public Command Surface
topics: [reference, cli]
sources:
  - id: pyproject
    type: file
    path: pyproject.toml
    note: Package script entrypoint for the CodeAlmanac CLI.
  - id: parser_root
    type: file
    path: src/codealmanac/cli/parser/root.py
    note: Root parser, version flag, public command metavar, and command-family registration.
  - id: parser_run
    type: file
    path: src/codealmanac/cli/parser/run_commands.py
    note: Run command syntax, sync syntax, and hidden run worker commands.
  - id: parser_argument
    type: file
    path: src/codealmanac/cli/parser/argument_parser.py
    note: Custom parser class that turns parser failures into shaped syntax problems.
  - id: syntax_catalog
    type: file
    path: src/codealmanac/cli/syntax/catalog.py
    note: Command guides and replacements used when syntax errors render.
  - id: parser_wiki
    type: file
    path: src/codealmanac/cli/parser/wiki.py
    note: Wiki read, validation, viewer, topic, and tagging command syntax.
  - id: parser_admin
    type: file
    path: src/codealmanac/cli/parser/admin.py
    note: Admin command-family registration.
  - id: parser_diagnostics
    type: file
    path: src/codealmanac/cli/parser/diagnostics.py
    note: Doctor command syntax.
  - id: parser_updates
    type: file
    path: src/codealmanac/cli/parser/updates.py
    note: Update command syntax and hidden scheduled flag.
  - id: parser_config
    type: file
    path: src/codealmanac/cli/parser/config.py
    note: Config command syntax and supported config keys.
  - id: parser_setup
    type: file
    path: src/codealmanac/cli/parser/setup.py
    note: Setup and uninstall command syntax.
  - id: parser_jobs
    type: file
    path: src/codealmanac/cli/parser/jobs.py
    note: Job listing, log, attach, and cancel command syntax.
  - id: parser_automation
    type: file
    path: src/codealmanac/cli/parser/automation.py
    note: Scheduled automation command syntax.
  - id: cli_tests
    type: file
    path: tests/test_cli.py
    note: CLI tests for rejected legacy flags and help output.
---

# Public Command Surface

The public command surface is the set of terminal commands exposed by the `codealmanac` script. The package installs that script as `codealmanac = "codealmanac.cli.main:main"`, so the CLI parser is the user-facing contract for command names and flags [@pyproject]. Parser modules define syntax only; the [CLI adapter boundary](../../architecture/cli/adapter-boundary) explains how parsed commands cross into services and workflows.

The root parser registers three command families: run commands, wiki commands, and admin commands [@parser_root]. The admin family delegates to config, setup, diagnostics, update, jobs, and automation parser modules [@parser_admin]. It also exposes `--version` and lists the visible top-level command names in `PUBLIC_COMMAND_METAVAR` [@parser_root]. Hidden worker commands exist for internal scheduling and queue execution, but they are removed from visible choices and from rendered syntax guidance [@parser_run] [@syntax_catalog].

Parser failures go through the custom argument parser, which classifies syntax problems before the CLI renderer turns them into user-facing guidance [@parser_argument].

## Top-Level Commands

| Command | Purpose | Main options |
|---|---|---|
| `init [path]` | Initialize a local Almanac wiki. | `--name`, `--description`, `--using`, `--guidance`, `--json` [@parser_run] |
| `ingest <inputs...>` | Queue ingest work over local material. | `--wiki`, `--using`, `--title`, `--guidance`, `--json` [@parser_run] |
| `garden` | Queue wiki improvement work. | `--wiki`, `--using`, `--title`, `--guidance`, `--json` [@parser_run] |
| `sync` | Sync recently active transcripts into wiki work. | `--wiki`, `--from`, `--using`, `--json`; subcommand `status` [@parser_run] |
| `list` | List registered local wikis. | `--json` [@parser_wiki] |
| `search [query]` | Search the selected wiki. | `--wiki`, `--topic`, `--mentions`, `--limit`, `--slugs`, `--json` [@parser_wiki] |
| `show <page>` | Show one indexed wiki page. | `--wiki`, `--json`, `--body`, `--meta`, `--lead`, `--links`, `--backlinks`, `--files`, `--topics` [@parser_wiki] |
| `topics` | List, inspect, and mutate topics. | `show`, `create`, `describe`, `link`, `unlink`, `rename`, `delete` [@parser_wiki] |
| `health` | Report graph and source health. | `--wiki`, `--json` [@parser_wiki] |
| `validate` | Validate the local wiki and return nonzero when issues exist. | `--wiki`, `--json` [@parser_wiki] |
| `reindex` | Force a full index rebuild. | `--wiki`, `--json` [@parser_wiki] |
| `serve` | Serve the local wiki viewer. | `--wiki`, `--host`, `--port`; defaults to `127.0.0.1:3927` [@parser_wiki] |
| `tag <page> <topics...>` | Add topics to a page frontmatter block. | `--wiki` [@parser_wiki] |
| `untag <page> <topics...>` | Remove topics from a page frontmatter block. | `--wiki` [@parser_wiki] |
| `config` | Read or write user config values. | `list`, `get`, `set`; keys are `auto_commit`, `harness.default`, and `harness.model` [@parser_config] |
| `setup` | Install local agent instructions and scheduled automation. | `--target`, `--yes`, `--runner`, `--no-auto-commit`, `--skip-instructions`, `--no-auto-update`, `--sync-every`, `--sync-off`, `--garden-every`, `--garden-off`, `--json` [@parser_setup] |
| `uninstall` | Remove setup-owned local artifacts. | `--yes`, `--json` [@parser_setup] |
| `doctor` | Check the local install and selected wiki. | `--wiki`, `--json` [@parser_diagnostics] |
| `update` | Update the local CLI. | `--check`, `--json`; `--scheduled` is hidden [@parser_updates] |
| `jobs` | Inspect local run records. | `--wiki`, `--limit`, `--json`; subcommands `show`, `logs`, `attach`, `cancel` [@parser_jobs] |
| `automation` | Manage scheduled local automation. | `install`, `uninstall`, `status`; task filters and `--json` [@parser_automation] |

The run commands are covered in the workflow architecture pages. The exact machine-readable output surface is covered by [JSON output contract](json-output-contract).

## Hidden Commands

Two top-level commands are intentionally hidden from normal help: `__run-worker` and `__garden-scheduler` [@parser_run]. `__run-worker` requires `--cwd` and drains queued run work for a repository; `__garden-scheduler` is the scheduled garden entrypoint [@parser_run].

The `update --scheduled` flag is also hidden from help while remaining accepted by the update parser [@parser_updates]. These hidden entries are implementation entrypoints, not public user workflows.

## Intentionally Absent Legacy Surface

The parser rejects removed or unsupported flags because they are not registered. Tests assert that `init --root`, `list --drop`, `search --include-archive`, and `search --archived` fail as unrecognized arguments rather than silently mapping to legacy behavior [@cli_tests].

That absence is part of the surface. New repos use the fixed `almanac/` tree, registered repositories are not auto-dropped by `list`, and archive flags are not part of the current search parser. When adding a command, follow [Add a CLI command](../../guides/add-a-cli-command) and keep syntax in the parser family that owns the command.
