---
title: JSON Output Contract
topics: [reference, cli]
sources:
  - id: common_render
    type: file
    path: src/codealmanac/cli/render/common.py
    note: Shared JSON rendering helpers and index summary formatting.
  - id: run_render
    type: file
    path: src/codealmanac/cli/render/run_commands.py
    note: JSON receipts for init and queued lifecycle runs.
  - id: repositories_render
    type: file
    path: src/codealmanac/cli/render/repositories.py
    note: JSON rows for registered wiki listing.
  - id: cli_tests
    type: file
    path: tests/test_cli.py
    note: CLI tests that assert JSON output for setup, list, reindex, update, doctor, ingest, automation, jobs, and health.
  - id: cli_main
    type: file
    path: src/codealmanac/cli/main.py
    note: CLI entrypoint and product error handling.
  - id: wiki_dispatch
    type: file
    path: src/codealmanac/cli/dispatch/wiki.py
    note: Wiki command dispatch and validate exit behavior with JSON output.
  - id: parser_wiki
    type: file
    path: src/codealmanac/cli/parser/wiki.py
    note: Wiki command syntax and JSON flag coverage.
---

# JSON Output Contract

`--json` is the machine-readable output surface for CodeAlmanac commands that support structured output. In JSON mode, renderers write JSON to stdout, usually with two-space indentation, while the command's exit code still reports success or failure [@common_render] [@cli_tests]. The JSON surface belongs to CLI render modules, which is why it is part of [Terminal output](../../architecture/cli/terminal-output).

The contract is command-specific. Some commands print Pydantic models through shared helpers; others print hand-built receipts with only the fields useful to scripts [@common_render] [@run_render]. Callers should treat each command's JSON shape as the stable unit, not assume a single global envelope.

## Shared Model Output

`print_json_model()` prints `model.model_dump(mode="json")` with indentation, and `print_json_rows()` prints an array of Pydantic model dumps [@common_render]. Renderers use this path when the service result is already the desired public shape.

`health --json`, `validate --json`, and `reindex --json` use structured model output through their renderers [@wiki_dispatch]. Tests assert that `reindex --json` includes fields such as `pages_indexed`, and that `health --json` includes graph findings such as `broken_links` and `target_slug` [@cli_tests].

## Command-Specific Receipts

Some JSON outputs are receipts rather than direct service model dumps. `init` now queues a build run through the same run-worker path as `ingest` and `garden`, so `init --json` prints the same queue receipt shape: `run_id`, `repository`, `runs_ahead`, `status`, and `child_pid` [@run_render]. It no longer prints wiki path, database path, indexed page count, or a summary; the caller follows up with `codealmanac jobs show <run-id>` for the completed build's result.

`list --json` prints an array of objects. Each row contains a dumped `repository` object and a `status` value such as `available` [@repositories_render]. Tests assert fields including repository `name`, `almanac_root`, and row `status` [@cli_tests].

Other tested JSON surfaces include setup plans and results, update plans, doctor diagnostics, automation status, job logs, job lists, job cancellation, and health output [@cli_tests]. These shapes are owned by the renderers for those command families.

## Streams And Exit Codes

JSON output goes to stdout. Product and validation errors caught by `main()` still print text to stderr with the `codealmanac:` prefix and return exit code `1`, even when the user supplied `--json`; parser-edge syntax failures render CodeAlmanac syntax screens on stderr and return exit code `2` [@cli_main] [@cli_tests]. See [Error and exit code contract](error-and-exit-code-contract) for the stderr and return-code rules.

`validate --json` is the main structured failure case. It prints a `ValidationResult` JSON object, then returns `0` when `ok` is true and `1` when `ok` is false [@wiki_dispatch]. Scripts should read both the JSON body and the process exit code.

## Commands Without JSON

Not every public command has `--json`. The parser exposes JSON flags only on selected commands, so commands such as `serve`, `tag`, `untag`, and topic mutation subcommands are human-output commands today [@parser_wiki]. The full supported command set is listed in [Public command surface](public-command-surface).
