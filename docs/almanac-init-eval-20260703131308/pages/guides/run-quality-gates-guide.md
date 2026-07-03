---
title: Run Quality Gates Guide
topics: [guides, testing]
sources:
  - id: contributing
    type: file
    path: CONTRIBUTING.md
  - id: pyproject
    type: file
    path: pyproject.toml
  - id: public
    type: file
    path: tests/test_public_contract.py
---

# Run Quality Gates Guide

Use this guide before handing off code changes. The expected outcome is that the Python tests and lint gates match the repo's active package, not the archived Node implementation.

## Default Gates

Run:

```bash
uv run pytest
uv run ruff check .
```

The project config sets `tests/` as the pytest path and `src` as `pythonpath`; ruff targets Python 3.12 [@pyproject].

## Risk-Based Additions

Run `tests/test_public_contract.py` after changing README, release docs, package metadata, CLI surface, user state paths, or next-agent brief content [@public]. Run architecture tests after moving services, workflows, stores, integrations, or CLI boundaries.

Use [[release-and-test-gates-reference]] when preparing a package release.
