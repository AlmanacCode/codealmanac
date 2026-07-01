# Slice 115: Topic Service Boundaries

## Scope

Keep topic behavior unchanged while making the topic service boundary clearer.
`TopicsService` should read as the public topic use cases: list, show, create,
describe, link, unlink, rename, and delete.

## Out of scope

- No CLI surface changes.
- No topic YAML format changes.
- No page frontmatter rewrite behavior changes.
- No archive or compatibility behavior changes.

## Design

Cosmic Python chapter 4 frames the service layer as "the entrypoint to our
domain model." For this slice, that means the topic service should orchestrate
topic operations, while graph mechanics and workspace selection live in named
topic-owned modules.

Target shape:

```python
workspace = resolve_topic_workspace(workspaces, request.cwd, request.wiki)
existing = existing_topic_slugs(index, workspace.workspace_id)
require_topics(existing, request.child, request.parent)
reject_cycle(topic_file.definitions, request.child, request.parent)
```

`TopicsService` stays the service-facing API. `topics/graph.py` owns topic DAG
validation. `topics/read_model.py` owns topic slug lookup through the derived
index. `topics/workspace.py` owns the small current-repo vs selected-wiki
choice.

## Verification

- Focused topic mutation and health tests.
- Architecture guard preventing graph/workspace helpers from regrowing inside
  `service.py`.
- Isolated local dogfood for topic create, link, show, rename, delete.
