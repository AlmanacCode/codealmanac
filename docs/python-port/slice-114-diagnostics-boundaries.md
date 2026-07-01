# Slice 114 - Diagnostics Boundaries

Date: 2026-07-01

## Scope

Split `codealmanac doctor` service mechanics by the thing being diagnosed.

`DiagnosticsService` currently owns the public `check(...)` verb, install
checks, wiki selection, registry checks, index checks, manual checks, health
summaries, pluralization, and error-line formatting. That makes the service
read like a command implementation instead of a service-layer entrypoint.

## Non-Goals

- No public `doctor` output changes.
- No new `doctor --fix` or repair machinery.
- No hosted/provider readiness checks.
- No CLI render changes.

## Shape

```python
DiagnosticsService.check(request)
    install=install_checks(...)
    wiki=wiki_checks(...)
```

`diagnostics.install` owns package/runtime/manual-package checks.
`diagnostics.wiki` owns selected-wiki readiness checks: registry status, index,
workspace manual, and health.

## Cosmic Python Transfer

Chapter 4 describes the service layer as the use-case entrypoint. For
CodeAlmanac, `DiagnosticsService` should expose the `doctor` use case while
focused modules own the check families. This keeps CLI and future server edges
calling one service without making that service own every check mechanic.

## Files

- `src/codealmanac/services/diagnostics/service.py`
- `src/codealmanac/services/diagnostics/install.py`
- `src/codealmanac/services/diagnostics/wiki.py`
- `tests/test_architecture.py`
- steering docs under `docs/python-port/`

## Verification

Focused:

```bash
uv run pytest tests/test_diagnostics.py tests/test_cli.py::test_cli_doctor_json_reports_no_wiki tests/test_cli.py::test_cli_doctor_reports_manual_drift tests/test_architecture.py::test_diagnostics_service_stays_facade -q
uv run ruff check src/codealmanac/services/diagnostics tests/test_diagnostics.py tests/test_cli.py tests/test_architecture.py
```

Broad:

```bash
uv run pytest
uv run ruff check .
git diff --check
```
