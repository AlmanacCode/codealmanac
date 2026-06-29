# Slice 50 - Index Read Views

Date: 2026-06-29

## Scope

Split read-only SQLite index queries out of the projection store.

## Decisions

- Keep `IndexStore` as the facade used by `IndexService`.
- Keep projection ownership in `services/index/store.py`: schema migration,
  source loading, freshness signatures, and writes into `index.db`.
- Move read-only query/view construction into `services/index/views.py`.
- Return the same Pydantic models from reads: `SearchPageResult`, `PageView`,
  `TopicSummary`, `TopicDetail`, and `HealthReport`.
- Do not optimize refresh cost in this slice. `ensure_fresh` still parses
  source markdown to compute the source signature.

## Cosmic Python Transfer

Cosmic Python chapter 12 recommends splitting read-only views from
state-changing command/event handlers even without full CQRS machinery.
CodeAlmanac's `index.db` is a derived read model, so the same smaller pattern
fits here:

```python
class IndexStore:
    def refresh(self, root):
        ...

    def search(self, root, request):
        with connect_index(index_db_path(root)) as connection:
            return search_pages(connection, request)
```

`views.py` reads the projection and maps rows into typed Pydantic models. It
does not load markdown, apply migrations, or run write SQL.

## Files

- `src/codealmanac/services/index/store.py`
- `src/codealmanac/services/index/views.py`
- `tests/test_architecture.py`

## Verification

- Focused read-model, topic health, viewer service, CLI read, and architecture
  tests.
- Focused ruff over index services and related tests.
- Temp-repo CLI dogfood for `search`, `search --mentions`, `show --backlinks`,
  `topics show`, and `health`.
- Full pytest, full ruff, diff check, package build, and wheel inspection.
