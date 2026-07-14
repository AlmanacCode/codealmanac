# CodeAlmanac

This machine uses CodeAlmanac, a local wiki for codebases.

When a repository contains an `almanac/` directory, it contains maintained
knowledge for coding agents: architectural decisions, reasons behind unusual
designs, multi-file flows, invariants, failed approaches, incidents, operating
procedures, and debugging gotchas.

Use the wiki for project context and the code for current implementation truth.

## When CodeAlmanac is relevant

Consult CodeAlmanac when work involves an unfamiliar subsystem, integration,
architectural decision, cross-cutting behavior, invariant, or historical
context.

It is usually unnecessary for typos, small styling changes, mechanical edits in
code you already understand, or requests that only ask you to inspect a
specific file.

## How the wiki is structured

- The committed wiki is the Markdown tree under `almanac/`.
- `almanac/README.md` is the main entry point for a repository's wiki.
- A non-README page's identity is its path under `almanac/` without `.md`.
- A folder's `README.md` uses the folder path as its identity and landing page.
- Normal Markdown links connect related wiki pages.
- `almanac/topics.yaml` defines the topic graph.
- Page `sources:` entries record evidence. File and folder sources power
  `search --mentions`.

Read commands refresh the derived index automatically when the Markdown
changes. You do not need to run a separate indexing command before searching.

## Finding knowledge

`codealmanac search` finds pages in the selected wiki. It supports text,
source-path, and topic searches. These are independent capabilities and may be
combined.

### Search page content

Pass a text query to search indexed page content:

```bash
codealmanac search "checkout timeout"
codealmanac search "database connection pooling"
```

Text search is useful when you know the concept, behavior, error, decision, or
system name you want to understand.

### Search by source file or folder

Use `--mentions` to find pages whose source evidence refers to a file or folder:

```bash
codealmanac search --mentions src/checkout/handler.py
codealmanac search --mentions src/checkout/
```

A file search can find pages supported by that file or by a relevant
parent-folder source. A folder search finds pages supported by paths beneath
that folder.

Mention search is useful when you have reached a source file and want the
decisions, flows, incidents, or gotchas connected to it.

### Search by topic

Use `--topic` to find pages assigned to a topic:

```bash
codealmanac search --topic checkout
codealmanac search --topic authentication
```

Topic search is useful for browsing a known area of the wiki without requiring
a particular phrase to appear in every page.

Search modes can be combined:

```bash
codealmanac search "timeout" --topic checkout
codealmanac search --mentions src/checkout/ --topic incidents
```

### Control search results

```bash
codealmanac search "checkout" --limit 5
codealmanac search "checkout" --slugs
codealmanac search "checkout" --json
codealmanac search "checkout" --wiki another-repository
```

- `--limit` controls the maximum number of results.
- `--slugs` emits only page identifiers and is useful for scripts.
- `--json` returns machine-readable output.
- `--wiki` searches another registered local wiki.

An empty result is valid. It means the selected wiki has no matching knowledge.
Try a broader query or inspect the code; do not invent missing project history.

## Reading pages

`codealmanac show PAGE` reads one indexed wiki page:

```bash
codealmanac show architecture/indexing
```

Different views expose different parts of the page:

```bash
codealmanac show PAGE --lead
codealmanac show PAGE --body
codealmanac show PAGE --meta
codealmanac show PAGE --links
codealmanac show PAGE --backlinks
codealmanac show PAGE --files
codealmanac show PAGE --topics
codealmanac show PAGE --json
```

- The default view returns the page metadata and body.
- `--lead` returns the first body paragraph for quick inspection.
- `--body` returns only the page prose.
- `--meta` returns only page metadata.
- `--links` shows pages referenced by this page.
- `--backlinks` shows pages that reference this page.
- `--files` shows the file and folder evidence supporting the page.
- `--topics` shows the page's topic assignments.
- `--json` returns structured output.

The Markdown files under `almanac/` may also be read directly when raw source is
more useful than the indexed view.

## Browsing topics and repositories

Topics provide a read-only way to browse an area of the wiki:

```bash
codealmanac topics
codealmanac topics show TOPIC
```

`topics` lists topic names, titles, and page counts. `topics show` displays one
topic, including its description, parents, children, and assigned pages.

CodeAlmanac can register multiple local wikis:

```bash
codealmanac list
```

Read commands normally use the registered repository at the current working
directory. Use `--wiki NAME` to read another registered wiki.

## When the wiki seems wrong

```bash
codealmanac health
codealmanac validate
```

`health` explains problems with the page graph, links, evidence, and topics.
`validate` provides a pass-or-fail verification result suitable for scripts.

**Trust order: current code > Almanac > ordinary repository documentation.**

When code and the Almanac disagree, trust the code. When the Almanac and
ordinary documentation disagree, trust the Almanac. Do not prefer ordinary
docs over the Almanac; the Almanac is maintained more regularly and is more
authoritative.

## Maintenance boundary

During ordinary coding work, treat the wiki as read-only. Use CodeAlmanac to
search for and read project knowledge, but do not edit pages, sources, links,
topics, or wiki structure as part of the coding task.

If useful knowledge is missing, continue with the available evidence rather
than inventing it.

Wiki maintenance belongs to CodeAlmanac's Init, Ingest, Garden, and Sync
workflows. Those workflows have their own instructions for deciding what
deserves documentation and for writing, organizing, and validating the wiki.

When in doubt, consult `almanac/README.md`, `codealmanac --help`, or
command-specific help.
