---
title: Release And Test Gates Reference
topics: [reference, testing, release]
sources:
  - id: contributing
    type: file
    path: CONTRIBUTING.md
  - id: release
    type: file
    path: RELEASE.md
  - id: pyproject
    type: file
    path: pyproject.toml
  - id: public
    type: file
    path: tests/test_public_contract.py
---

# Release And Test Gates Reference

This page lists the repo's standard validation and release gates. Use [[run-quality-gates-guide]] for task-oriented guidance.

## Development Gates

The default Python gates are `uv run pytest` and `uv run ruff check .`; pytest discovers tests under `tests/` with `src` on `pythonpath`, and ruff targets Python 3.12 with line length 88 [@pyproject].

Public-contract tests require Python package metadata, `codealmanac` as the only script, `~/.codealmanac` state paths, README command examples, current next-agent brief slice tracking, and Python GitHub workflow wording [@public].

## Release Gates

Release documentation uses Python packaging commands such as `uv build --out-dir dist`, `uvx twine check dist/*`, and `uvx twine upload dist/*`, and forbids npm-era release commands [@release].
