---
title: CodeAlmanac Public Surface Decision
topics: [decisions, cli, product]
sources:
  - id: agreement
    type: file
    path: docs/python-port-live-agreement.md
  - id: pyproject
    type: file
    path: pyproject.toml
  - id: tests
    type: file
    path: tests/test_public_contract.py
---

# CodeAlmanac Public Surface Decision

The public CLI and package name is `codealmanac`. The Python rewrite intentionally does not publish `almanac` or `alm` aliases and uses `~/.codealmanac/` for user state [@agreement].

## Context

The old implementation used different naming in places, but the rewrite targets a clean public surface. The test suite forbids old top-level commands such as `absorb`, `connect`, `mcp`, `sdk`, `source`, `sources`, `upload`, and `use` [@tests].

## Decision

Only the `codealmanac` console script is exposed from package metadata [@pyproject]. Public docs must use Python install and run commands, not Node/npm-era commands [@tests].

## Consequences

Command changes must update [[cli-command-surface-reference]] and public-contract tests. State-path changes must update [[user-and-repo-state-paths-reference]].
