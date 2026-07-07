---
title: Error And Exit Code Contract
topics: [reference, cli]
sources:
  - id: cli_main
    type: file
    path: src/codealmanac/cli/main.py
    note: CLI entrypoint, parser invocation, product error handling, and returned exit codes.
  - id: core_errors
    type: file
    path: src/codealmanac/core/errors.py
    note: Product error classes, error codes, and summary helper.
  - id: health_render
    type: file
    path: src/codealmanac/cli/render/health.py
    note: Human and JSON rendering for health and validate.
  - id: wiki_dispatch
    type: file
    path: src/codealmanac/cli/dispatch/wiki.py
    note: Wiki command dispatch and validate return-code rule.
  - id: setup_dispatch
    type: file
    path: src/codealmanac/cli/dispatch/setup.py
    note: Setup cancellation, uninstall confirmation, and uninstall exit-code rule.
  - id: validate_tests
    type: file
    path: tests/test_validate.py
    note: Validation result tests and CLI validate nonzero behavior.
  - id: cli_tests
    type: file
    path: tests/test_cli.py
    note: CLI tests for argparse errors, rejected legacy flags, stderr, and command outcomes.
---

# Error And Exit Code Contract

The CLI uses process exit codes and stderr as part of its public behavior. Successful commands return `0`; product errors and Pydantic validation errors caught by `main()` print `codealmanac: ...` to stderr and return `1` [@cli_main]. Argparse syntax errors are handled by argparse before dispatch, so invalid command lines usually raise argparse's `SystemExit` path with usage text and exit code `2` [@cli_tests].

The contract is intentionally small. Services raise typed product errors, renderers print command results, and the CLI entrypoint translates crossing-edge failures into stderr and integer exits [@cli_main] [@core_errors]. This keeps error handling aligned with [Terminal output](../../architecture/cli/terminal-output) and the [Public command surface](public-command-surface).

## Product Errors

All product errors that cross the CLI edge inherit from `CodeAlmanacError` [@core_errors]. The defined error codes are `codealmanac_error`, `already_exists`, `not_found`, `repository_not_selected`, `conflict`, `validation_failed`, and `execution_failed` [@core_errors]. The CLI currently prints the text form of these errors rather than a structured error object [@cli_main].

`NoRepositorySelected` tells the user to run from a registered repository root or pass `--wiki <name>` [@core_errors]. `NotFoundError`, `AlreadyExists`, `ConflictError`, `ValidationFailed`, and `ExecutionFailed` carry resource, conflict, validation, or execution failures from services to the entrypoint [@core_errors].

## Syntax And Validation Errors

Unsupported parser options are command-line syntax errors. Tests assert that removed or unsupported options such as `init --root`, `list --drop`, `search --include-archive`, and `search --archived` are rejected as unrecognized arguments [@cli_tests]. These failures are not product errors; they are parser failures.

Pydantic validation errors that occur after parsing are caught by `main()` and returned as exit code `1` with the `codealmanac:` prefix [@cli_main]. The job command test for a path-shaped run id expects no stdout and a validation message on stderr [@cli_tests].

## Validate And Health

`health` reports wiki health and returns `0` after rendering the report [@wiki_dispatch]. `validate` renders a validation result and returns `0` only when `result.ok` is true; it returns `1` when validation issues exist [@wiki_dispatch]. The human renderer prints `validate: ok` or `validate: failed`, the repository name, the wiki path, index information when present, and issue rows [@health_render].

Validation issues include source shape failures, runtime-state leaks, page route collisions, broken Markdown links, dead file refs, empty topics, empty pages, missing source citations, unused sources, and duplicate sources [@validate_tests]. Tests assert that a broken Markdown link makes `codealmanac validate` return `1` and print the `broken_links` category [@validate_tests].

## Command-Specific Nonzero Results

Some commands return `1` as a normal command outcome without going through `main()`'s product-error catch. `uninstall` returns `1` when confirmation is declined in a non-interactive shell, and it also returns `1` when package uninstall fails [@setup_dispatch] [@cli_tests]. Setup cancellation prints a cancellation message to stderr and returns `1` [@setup_dispatch].

These command outcomes are still terminal contracts. Scripts should check the process exit code first, then parse stdout only when the command is expected to produce a usable result.
