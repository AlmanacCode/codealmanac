---
title: CLI Command Surface Reference
topics: [reference, cli]
sources:
  - id: wiki
    type: file
    path: src/codealmanac/cli/parser/wiki.py
  - id: lifecycle
    type: file
    path: src/codealmanac/cli/parser/lifecycle.py
  - id: local
    type: file
    path: src/codealmanac/cli/parser/local.py
  - id: public-tests
    type: file
    path: tests/test_public_contract.py
---

# CLI Command Surface Reference

This page lists the stable `codealmanac` command families defined by the argparse parser. It is a lookup page for CLI changes; [[cli-adapter-boundary]] explains the parser/dispatch/render architecture.

## Wiki Commands

- `list [--json] [--drop SELECTOR | --drop-missing]` lists or prunes registered local wikis [@wiki].
- `search [query] [--wiki WIKI] [--topic TOPIC] [--mentions PATH] [--limit N] [--json]` searches indexed pages [@wiki].
- `show SLUG [--wiki WIKI] [--json] [--body|--meta|--lead|--links|--backlinks|--files|--topics]` reads one page [@wiki].
- `topics` plus `show/create/describe/link/unlink/rename/delete` manages topic metadata and edges [@wiki].
- `health`, `reindex`, `serve`, `tag`, and `untag` operate on the selected wiki [@wiki].

## Lifecycle Commands

- `init [path] [--root ROOT] [--name NAME] [--description TEXT] [--using codex|claude] [--background|--foreground] [--force] [--yes] [--verbose] [--guidance TEXT] [--json]` initializes and first-builds a wiki [@lifecycle].
- `sync [status]` accepts wiki/source app/quiet/pending/failed-attempt/background/foreground/harness/json controls [@lifecycle].
- `__run-worker`, `__run-local-worker`, and `__record-local-trigger` are hidden process entrypoints, not public user commands [@lifecycle].

## Local And Public Surface Rules

`local status`, `local update`, `local setup`, `local triggers`, `local delivery`, and `local jobs` manage the local control plane [@local]. Public-contract tests require the package script to be exactly `codealmanac` and forbid old top-level surfaces such as `absorb`, `connect`, `mcp`, `sdk`, and `upload` [@public-tests].
