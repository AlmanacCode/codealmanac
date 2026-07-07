# Test Migration Plan

Goal: migrate the Python tests to the current architecture so the full suite is useful again.

The new source of truth uses repositories, operations, jobs, explicit runner models, and local `codealmanac.db` state. Tests should follow those nouns. Do not keep compatibility aliases such as workspace request names, old build request names, old sync quiet-window fields, or retired automation constants just to make tests pass.

## Tasks

1. Fix collection errors by updating imports and request/model names.
2. Add required runner model values to workflow and harness requests.
3. Replace workspace vocabulary with repository vocabulary in tests.
4. Update config and sync expectations to the simplified current product.
5. Run `uv run pytest`; fix real failures without adding production shims for old tests.
6. Run `uv run ruff check .` and the package verification gate before merging.

Full success means the tests describe the code we intend to ship, not the old branch shape.
