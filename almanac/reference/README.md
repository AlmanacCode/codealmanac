---
title: Reference
topics: [reference, overview]
sources:
  - id: topics
    type: file
    path: almanac/topics.yaml
    note: Topic graph entry that defines reference as exact lookup material.
  - id: command-surface
    type: wiki
    path: reference/cli/public-command-surface
    note: Command reference for public CLI names, flags, hidden entries, and intentionally absent legacy surface.
  - id: json-output
    type: wiki
    path: reference/cli/json-output-contract
    note: Reference page for command JSON output behavior.
  - id: error-exit
    type: wiki
    path: reference/cli/error-and-exit-code-contract
    note: Reference page for CLI error messages and exit codes.
  - id: page-format
    type: wiki
    path: reference/page-format/frontmatter-and-sources
    note: Page metadata, evidence source, citation, and file reference contract.
  - id: links-routes
    type: wiki
    path: reference/page-format/links-and-routes
    note: Reference page for Markdown page links and route resolution.
  - id: run-states
    type: wiki
    path: reference/runs/run-states-and-events
    note: Run kind, status, event, queued spec, cancellation, attach, and log contract.
  - id: source-addresses
    type: wiki
    path: reference/sources/source-addresses
    note: Accepted ingest source address forms and typed source refs.
  - id: config-keys
    type: wiki
    path: reference/config-keys
    note: Supported config keys, precedence, defaults, and validation.
  - id: local-state
    type: wiki
    path: reference/local-state-layout
    note: Runtime file layout and committed wiki source boundary.
  - id: topics-yaml
    type: wiki
    path: reference/topics-yaml
    note: Authored topic file schema and mutation behavior.
  - id: harness-events
    type: wiki
    path: reference/harness-event-shape
    note: Reference page for normalized harness event payloads.
  - id: cosmic-python
    type: wiki
    path: reference/cosmic-python-translation
    note: Reference page for the local Architecture Patterns with Python translation.
---

# Reference

Reference pages are exact lookup material for CodeAlmanac commands, page
formats, source addresses, run records, config keys, local state, and topic
metadata. The topic graph defines `reference` as the wiki neighborhood for
commands, formats, and states, and this hub routes readers to the narrow page
that owns each contract [@topics].

Use this page when you already know the part of the system you need to verify.
For narrative system shape, start with [Architecture](../architecture/)
instead; for task steps, start with the relevant guide.

## Public Surfaces

[Public command surface](cli/public-command-surface) lists the visible
`codealmanac` commands, their main options, hidden worker entries, and legacy
flags that are intentionally absent [@command-surface]. Pair it with [JSON
output contract](cli/json-output-contract) when a command needs machine-readable
output, or [Error and exit code contract](cli/error-and-exit-code-contract)
when changing terminal failures [@json-output] [@error-exit].

[Config keys](config-keys) defines `auto_commit`, `harness.default`, and
`harness.model`, including precedence between CLI flags, project config, user
config, and built-in defaults [@config-keys].

## Wiki Page Format

[Frontmatter and sources](page-format/frontmatter-and-sources) defines the
supported page metadata fields, source entry shape, file-source indexing, and
inline citation checks [@page-format]. [Links and routes](page-format/links-and-routes)
defines Markdown page links, `README.md` folder routes, and the route forms the
viewer and index resolve [@links-routes].

[Topics YAML](topics-yaml) defines the authored `topics.yaml` schema, topic
slug normalization, parent DAG constraints, and mutation behavior for topic
commands [@topics-yaml].

## Runtime Lookup

[Run states and events](runs/run-states-and-events) is the ledger reference for
run kinds, statuses, event kinds, queued specs, cancellation, attach, and logs
[@run-states]. [Local state layout](local-state-layout) lists the committed
wiki paths and the runtime files under `~/.codealmanac/`, including the global
database, config file, per-repository index, update lock, and scheduler logs
[@local-state].

## Inputs And Harnesses

[Source addresses](sources/source-addresses) lists the raw ingest input forms,
their resolver order, accepted GitHub, URL, Git, transcript, and path shapes,
and the rejection rules for malformed inputs [@source-addresses].

[Harness event shape](harness-event-shape) defines the normalized event payload
shared by provider adapters and run logging. [Cosmic Python translation](cosmic-python-translation)
maps local architecture terms to the Architecture Patterns with Python ideas
used in this rewrite [@harness-events] [@cosmic-python].
