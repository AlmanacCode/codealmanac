---
page_id: architecture-testing-contracts
title: Testing Contracts
summary: The test suite encodes architecture boundaries and public product promises, not only behavior examples.
topics: [architecture]
sources:
  - id: architecture-tests
    type: file
    path: tests/test_architecture.py
  - id: public-contract-tests
    type: file
    path: tests/test_public_contract.py
---

# Testing Contracts

The Python test suite includes contract tests that preserve architecture and public product boundaries. Architecture tests enforce import direction, persistence ownership, CLI rendering boundaries, index read/write separation, viewer boundaries, and workspace service boundaries; public-contract tests reject stale Node, hosted, alias, and packaging language. [@architecture-tests] [@public-contract-tests]

## What do architecture tests protect?

They keep services, workflows, and CLI code from importing integrations, keep raw SQLite access inside the database package, keep Rich inside CLI render modules, and keep index query families split. [@architecture-tests]

## What do public-contract tests protect?

They require the public entrypoint to be `codealmanac`, require Python package metadata, assert `~/.codealmanac/` user state paths, and reject old hosted or Node-facing command language. [@public-contract-tests]

## What decisions do these tests support?

Read `[[decision-python-local-v1]]`, `[[decision-codealmanac-command-only]]`, and `[[decision-services-workflows-integrations-boundary]]`.

