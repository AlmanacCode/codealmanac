# Slice 5: Topic Metadata Mutation

## Scope

Add deterministic local topic DAG mutation commands:

```text
codealmanac topics create <name> [--parent <slug>]...
codealmanac topics describe <slug> <text>
codealmanac topics link <child> <parent>
codealmanac topics unlink <child> <parent>
```

This slice writes `.almanac/topics.yaml` only. It does not rewrite page
frontmatter.

## Out Of Scope

- `topics rename`
- `topics delete`
- any lifecycle AI workflow
- hosted sync, login, upload, MCP, or SDK behavior

Rename/delete require page-frontmatter rewrites across many files. They should
land after the smaller topic-file mutation path has review evidence.

## Architecture

`topics` owns product policy:

- validate requested topic slugs
- require parents to exist before creating edges
- promote page-only ad-hoc topics into `topics.yaml` when an explicit edge or
  description needs a durable topic record
- reject cycles before writing

`wiki` owns `topics.yaml` parse and rewrite. Use `ruamel.yaml` for round-trip
YAML mutation because comments/order are user-facing repo files.

`index` remains the read model. Mutation services call read methods before
deciding and refresh through existing query paths after writes.

The CLI only adapts arguments to request models and renders short summaries.

## Tests

- service-layer tests for create, parent validation, ad-hoc promotion,
  describe, link, unlink, and cycle rejection
- YAML rewrite tests for comment preservation and atomic replacement behavior
- CLI smoke for `topics create`, `topics link`, `topics describe`, and
  `topics show`
- live temp-repo smoke after implementation

## Cosmic Python Pressure

Chapter 5's useful pressure is to keep most behavior tests at the service
layer because that is the application API. Drop lower only for the fragile
YAML rewrite boundary.
