# Slice 16: Public Ingest CLI

## Scope

Expose the local lifecycle workflow through the public CLI:

```text
codealmanac ingest <inputs...> [--wiki <name>] [--using claude|codex]
  [--title <text>] [--guidance <text>]
```

The command is a thin adapter. It builds `RunIngestRequest` and calls
`app.workflows.ingest.run(...)`. It does not parse source refs, render prompts,
call providers, inspect Git state, write run records, refresh the index, or
decide whether a source deserves a wiki update.

## Architecture

The command shape is:

```python
result = app.workflows.ingest.run(
    RunIngestRequest(
        cwd=Path.cwd(),
        wiki=args.wiki,
        inputs=tuple(args.inputs),
        harness=HarnessKind(args.using),
        title=args.title,
        guidance=args.guidance,
    )
)
render_ingest(result)
```

`--using` defaults to `claude` because Claude is the only concrete adapter
wired by `create_app()` today. `codex` is accepted as a harness enum value so
the flag contract does not need to change when the Codex adapter lands; it
fails through the harness service until an adapter is wired.

## Claude CLI Fix

Real command dogfood exposed a Claude CLI parsing issue. Passing the prompt as
a positional argument after `--tools Read,Write,...` let the variadic `--tools`
option consume the prompt, and Claude returned:

```text
Error: Input must be provided either through stdin or as a prompt argument when using --print
```

The Claude adapter now sends the prompt through stdin. That keeps the prompt
out of variadic option parsing and matches Claude Code's documented `--print`
input contract.

The same dogfood exposed weak failure visibility. `validate_harness_result()`
now includes the first line of `HarnessRunResult.output_text` in the workflow
error, so provider auth and protocol failures appear in CLI stderr and run
records.

## Cosmic Python Translation

Chapter 10 distinguishes commands from events: commands express intent and
fail noisily, while events record facts. `codealmanac ingest` is now the public
command sender. `RunIngestRequest` remains the service/workflow command, and
run-log entries remain past-tense facts.

## Tests And Dogfood

- CLI help includes `ingest`.
- CLI test injects a fake app and verifies `ingest` adapts argv into
  `RunIngestRequest` without owning workflow behavior.
- Claude adapter tests pin stdin prompt delivery.
- Focused CLI, ingest, Claude adapter, and architecture tests pass.
- Real `codealmanac ingest note.md --using claude` dogfood in a temp Git repo
  created `.almanac/pages/ingest-cli-thin-adapter.md`, search found
  `ingest-cli-thin-adapter`, and Git status showed only that wiki page changed.
