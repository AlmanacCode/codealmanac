# App Composition Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make `src/codealmanac/app.py` easier to scan without changing product behavior or moving composition out of the composition root.

**Architecture:** Keep `create_app()` as the public factory and keep concrete adapters wired in `app.py`. Split the long function into private wiring helpers named for real dependency groups: services, page-run workflows, workflows, and final assembly. Do not introduce a DI framework, generic registry, or service locator.

**Tech Stack:** Python dataclasses, existing CodeAlmanac service/workflow constructors, pytest architecture tests, ruff.

---

## Read Before Coding

- `MANUAL.md`
- `almanac/style/boundaries.md`
- `almanac/style/refactoring.md`
- `docs/python-port-live-agreement.md`
- `docs/reference/cosmic-python/chapter_13_dependency_injection.md`

Useful local line from Cosmic Python:

> "Instead, we'll reach for a pattern called Composition Root ... and we'll do a bit of manual DI."

## Scope

In scope:

- Keep `create_app()` signature unchanged.
- Add private app-wiring helpers inside `src/codealmanac/app.py`.
- Keep all concrete defaults and test override behavior unchanged.
- Add or update an architecture test that guards `create_app()` against regrowing into one long wiring body.
- Update the refactor worklog.

Out of scope:

- No product behavior changes.
- No public app object shape changes.
- No new files unless a helper earns a real boundary. For this batch, helpers stay in `app.py`.
- No dependency injection framework or generic container.

## Target Shape

```python
def create_app(...) -> CodeAlmanac:
    app_config = config or AppConfig()
    runtime_paths = WorkspaceRuntimePaths(app_config.registry_path.parent)
    services = _create_services(app_config, runtime_paths, ...)
    workflows = _create_workflows(services, runtime_paths, ...)
    return _create_app(services, workflows)
```

The helpers are private because the public surface is still `create_app()`.

## Tasks

### Task 1: Add A Composition-Root Architecture Test

**Files:**

- Modify: `tests/test_architecture.py`

Steps:

1. Add a test near the other top-level architecture tests.
2. Parse `src/codealmanac/app.py` with `ast`.
3. Assert that `create_app()` stays below a small line cap.
4. Assert the helper names are present: `_create_services`, `_create_page_run`, `_create_workflows`, `_create_app`.
5. Run:

```bash
uv run pytest tests/test_architecture.py::test_app_composition_root_stays_scannable -q
```

Expected before implementation: fail because helpers do not exist and `create_app()` is too long.

### Task 2: Split The Wiring Helpers

**Files:**

- Modify: `src/codealmanac/app.py`

Steps:

1. Add a private frozen dataclass for the services created during wiring.
2. Move service construction into `_create_services(...)`.
3. Move repeated `PageRunWorkflow(...)` construction into `_create_page_run(...)`.
4. Move operation workflow construction into `_create_workflows(...)`.
5. Move final `CodeAlmanac(...)` assembly into `_create_app(...)`.
6. Keep every constructor argument and default adapter choice identical.
7. Run:

```bash
uv run pytest tests/test_architecture.py::test_app_composition_root_stays_scannable -q
uv run pytest tests/test_cli.py::test_cli_help_includes_update tests/test_config_service.py -q
uv run ruff check src/codealmanac/app.py tests/test_architecture.py
```

Expected: all pass.

### Task 3: Verify And Record The Milestone

**Files:**

- Modify: `docs/refactor-audit-2026-07-06/worklog.md`

Steps:

1. Add a short worklog section with the smell, files changed, and verification.
2. Run full gates:

```bash
uv run pytest
uv run ruff check .
git diff --check
```

Expected: all pass.

3. Commit:

```bash
git add src/codealmanac/app.py tests/test_architecture.py docs/plans/2026-07-06-app-composition-refactor.md docs/refactor-audit-2026-07-06/worklog.md
git commit -m "refactor: make app wiring scannable"
```
