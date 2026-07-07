---
title: CLI Adapter Boundary
topics: [architecture, cli]
sources:
  - id: cli-main
    type: file
    path: src/codealmanac/cli/main.py
    note: CLI entrypoint, parser invocation, app construction, and error handling.
  - id: parser-root
    type: file
    path: src/codealmanac/cli/parser/root.py
    note: Root parser and command-family registration.
  - id: dispatch-root
    type: file
    path: src/codealmanac/cli/dispatch/root.py
    note: Root dispatcher that routes to run, wiki, and admin command families.
  - id: dispatch-wiki
    type: file
    path: src/codealmanac/cli/dispatch/wiki.py
    note: Wiki command dispatch and request construction examples.
  - id: render-root
    type: file
    path: src/codealmanac/cli/render/root.py
    note: Render facade for stable dispatcher imports.
  - id: architecture-tests
    type: file
    path: tests/test_architecture.py
    note: Tests that keep parser, dispatch, and render modules split by command and output family.
---

# CLI Adapter Boundary

The CLI is an adapter around the application, not the internal API. Its job is to parse terminal arguments, create typed request models, call the `CodeAlmanac` app, and render results [@cli-main] [@dispatch-wiki]. Product behavior belongs in services and workflows assembled by the [Composition Root](../composition-root), while terminal wording belongs in render modules.

This boundary is split into three responsibilities: parser modules define public command syntax, dispatch modules translate parsed arguments into service or workflow calls, and render modules own human and JSON output. The root files are intentionally small facades so command-family modules can grow without turning one CLI file into the product center [@parser-root] [@dispatch-root] [@render-root].

## Entrypoint

`main()` builds the parser, parses `argv`, and delegates to `dispatch(args)`. It catches `CodeAlmanacError` and Pydantic `ValidationError`, prints `codealmanac: ...` to stderr, and returns exit code `1` [@cli-main]. The `dispatch(args)` helper constructs the app with `create_app()` and passes the parsed arguments plus app object to the root dispatcher [@cli-main].

That small entrypoint enforces the adapter role. The CLI owns process-level concerns: argument parsing, stderr for user-facing failures, and integer exit codes. It does not construct stores, choose integrations, or run lifecycle logic directly.

## Parser Boundary

`cli/parser/root.py` creates the `codealmanac` parser, installs `--version`, and registers command families through `add_run_commands`, `add_wiki_commands`, and `add_admin_commands` [@parser-root]. The public command metavar lists the visible command surface, including `init`, `ingest`, `garden`, `sync`, `search`, `show`, `topics`, `health`, `validate`, `serve`, `config`, `setup`, `jobs`, and `automation` [@parser-root].

Parser modules should describe syntax only. For example, the root parser knows that command families exist, but it does not know how search calls the index or how setup writes instructions. That keeps public command shape separate from product action.

## Dispatch Boundary

`cli/dispatch/root.py` routes by command family. It checks whether the command is a run, wiki, or admin command and delegates to that family dispatcher [@dispatch-root]. The architecture tests require this root dispatcher to stay short and to avoid importing request models such as `IngestRequest` or `SearchPagesRequest` [@architecture-tests].

Command-family dispatchers perform the adapter translation. Wiki search builds a `SearchPagesRequest` from the current directory, `--wiki`, query text, topic flags, mention filter, and limit, then calls `app.search.search(...)` and renders the result [@dispatch-wiki]. Show, health, validate, reindex, tag, and untag follow the same pattern: build the owning service request, call the app, render, and return an exit code [@dispatch-wiki].

## Render Boundary

`cli/render/root.py` is a re-export facade for dispatcher stability. It imports render functions from specific modules such as repositories, run commands, sync, and wiki renderers, then exposes them through `__all__` [@render-root]. It does not render text itself.

The tests protect this shape. They require render root to stay a facade, wiki render to stay split by output family, admin render to stay split by output family, and dispatch files to stay split by command domain [@architecture-tests]. This prevents a common CLI failure mode where parsing, service calls, JSON formatting, and terminal prose collapse into one file.

## Change Rule

When adding a CLI command, put syntax in the parser family, request construction in the dispatch family, and output in the render family. The command should cross into the core through [Request Models](../request-models), then return through a renderer. That keeps the CLI easy to test and keeps future server or worker entrypoints free to call the same services without shelling through terminal code.
