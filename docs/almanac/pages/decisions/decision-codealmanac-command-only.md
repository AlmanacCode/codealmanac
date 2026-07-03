---
page_id: decision-codealmanac-command-only
title: CodeAlmanac Command Only
summary: The public command and package surface is `codealmanac`, with no `almanac` or `alm` compatibility alias.
topics: [decisions]
sources:
  - id: live-agreement
    type: file
    path: docs/python-port-live-agreement.md
  - id: public-contract
    type: file
    path: tests/test_public_contract.py
  - id: pyproject
    type: file
    path: pyproject.toml
---

# CodeAlmanac Command Only

The Python package exposes one public command: `codealmanac`. The live agreement rejects public `almanac` and `alm` aliases, and the public-contract test requires the project scripts table to contain only `codealmanac = codealmanac.cli.main:main`. [@live-agreement] [@public-contract] [@pyproject]

## Status

Accepted. [@live-agreement]

## Context

The archived Node product and older docs used Almanac naming in some places. The Python rewrite targets new users and avoids TypeScript-era compatibility surfaces. [@live-agreement]

## Decision

We will keep the public command, package, and user-facing language on `codealmanac`. [@live-agreement]

## Consequences

Docs and tests should reject old install and command examples. Guides in this wiki should use `codealmanac`, and reference pages should not list compatibility aliases. See `[[reference-cli-commands]]`.

