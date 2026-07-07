---
title: CodeAlmanac Wiki
summary: Reading path for the local-first Python CodeAlmanac product.
topics: [architecture, decisions, operations]
sources:
  - id: readme
    type: file
    path: README.md
    note: Public product contract for the local alpha.
  - id: agreement
    type: file
    path: docs/python-port-live-agreement.md
    note: Living agreement for the Python rewrite.
  - id: manual
    type: file
    path: MANUAL.md
    note: Repo-specific build rules and product constraints.
---

# CodeAlmanac Wiki

CodeAlmanac is a local-first Python CLI that keeps a codebase wiki in `almanac/` and user-level state in `~/.codealmanac/` [@readme] [@agreement]. The product does not include hosted login, connect, upload, a public SDK surface, MCP, alternate roots, command aliases, or migration compatibility in this branch [@agreement] [@manual].

This wiki is the durable project memory for the current product. It carries forward useful knowledge from the old repository wiki, but its page shape follows the new nested `almanac/` model.

## Reading Path

Start with these pages:

- [Local-First Python](decisions/local-first-python) for the fork-point and product contract.
- [Wiki Tree](architecture/wiki-tree) for page identity, folder layout, and root detection.
- [Indexing](architecture/indexing) for the derived SQLite read model.
- [Runs](architecture/runs) for build, ingest, garden, harness execution, and run records.
- [Providers](architecture/providers) for Codex and Claude harness boundaries, auth requirements, and agent instruction installation.
- [Prompt Intelligence](decisions/prompt-intelligence) for the no-pipeline rule.
- [Source Provenance](decisions/source-provenance) for `sources:` and file evidence.
- [Configuration](reference/configuration) for config file locations, keys, defaults, and precedence.

## Notability Bar

Write a page when it preserves non-obvious project knowledge that will help a future agent work safely. Good pages explain a decision, cross-file flow, invariant, failure mode, external dependency, or product constraint.

Do not write pages that restate nearby code. Do not preserve hosted or cloud-era assumptions unless the page is explicitly explaining why they are out of scope.

## Page Shape

Pages are Markdown files under `almanac/`. A nested page such as `almanac/architecture/indexing.md` has the page id `architecture/indexing`; a folder landing page such as `almanac/architecture/README.md` has the page id `architecture`.

Use Markdown links between pages. Use `sources:` entries for evidence.
