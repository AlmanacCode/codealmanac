# Slice 3: Topics And Health

Date: 2026-06-29

## Scope

Add read-only organization commands on top of the SQLite read model:

- parse `.almanac/topics.yaml`
- index topic titles, descriptions, and parent edges
- add `codealmanac topics`
- add `codealmanac topics show <slug>`
- add `codealmanac topics show <slug> --descendants`
- add `codealmanac health`
- add `codealmanac health --json`

## Out Of Scope

- no tag/untag yet
- no topic mutation commands yet
- no frontmatter rewriting yet
- no lifecycle/AI commands
- no hosted commands

## Architecture

```python
app.topics.list(TopicListRequest(...))
app.topics.show(TopicShowRequest(...))
app.health.check(HealthCheckRequest(...))
```

`index` owns the derived SQLite graph. `topics` owns user-facing topic reads.
`health` owns report policy and may interrogate both the index and filesystem.
CLI only resolves arguments and renders.

Cosmic Python pressure from chapter 3 applies here: separate state
interrogation, decisions, and mutation. This slice has no mutation beyond
refreshing the derived index.

## Health Categories For This Slice

- `orphans`
- `dead_refs`
- `broken_links`
- `broken_xwiki` for unregistered or unreachable target wikis
- `empty_topics`
- `empty_pages`

`stale` can follow once duration parsing is restored. `slug_collisions` can
follow once the index stores collision events or health rescans pages.

## Verification

- `uv run pytest`
- `uv run ruff check .`
- isolated live `topics`, `topics show`, `health`, and `health --json`
- dogfood `codealmanac topics` and `codealmanac health` in this repo
