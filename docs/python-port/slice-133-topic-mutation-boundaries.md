# Slice 133: Topic Mutation Boundaries

## Scope

Keep `codealmanac topics` behavior unchanged while splitting topic write
mechanics out of the `TopicsService` facade.

## Out of scope

- No CLI command changes.
- No topic YAML schema changes.
- No page frontmatter rewrite behavior changes.
- No index read-model changes.

## Design

Cosmic Python chapter 4 describes service-layer methods as orchestration that
fetches current state, checks invariants, calls lower-level behavior, and
persists changed state (`docs/reference/cosmic-python/chapter_04_service_layer.md`).
In the current topics service, read methods and mutating file-rewrite workflows
live in one file. The facade is small enough to use, but too much mechanics now
sit behind the public service name.

The split is:

```python
services.topics.service      # TopicsService facade: public read/write methods
  -> mutations.py            # TopicMutationExecutor: create/describe/link/unlink/rename/delete
  -> graph.py                # DAG invariants
  -> workspace.py            # workspace selection helper
```

`TopicsService` keeps the public method names used by the app composition root
and CLI dispatch. Mutations move to `TopicMutationExecutor`, which owns topic
file loading, graph validation, page topic rewrites, topic-file writes, and
index refresh after writes.

## Verification

- Existing topic mutation tests.
- Existing CLI topic tests through the full test suite.
- Architecture guard that keeps topic file/rewrite mechanics out of
  `services/topics/service.py`.
- Public CLI dogfood for read-only `codealmanac topics` in this checkout.
- Full pytest, Ruff, and diff checks.
