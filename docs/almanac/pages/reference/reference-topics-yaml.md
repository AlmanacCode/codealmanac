---
page_id: reference-topics-yaml
title: Topics YAML
summary: This page describes topic definitions and parent relationships in `topics.yaml`.
topics: [reference, storage]
sources:
  - id: topic-models
    type: file
    path: src/codealmanac/services/wiki/topic_models.py
  - id: topic-file
    type: file
    path: src/codealmanac/services/wiki/topic_file.py
  - id: topic-graph
    type: file
    path: src/codealmanac/services/topics/graph.py
---

# Topics YAML

`topics.yaml` stores topic definitions. Each topic can have a title, description, and parent list, and topic graph helpers validate parent existence, reject self-parent edges, and reject cycles. [@topic-models] [@topic-file] [@topic-graph]

## Shape

```yaml
topics:
  systems:
    title: Systems
    description: Custom subsystems in this repo.
  lifecycle:
    title: Lifecycle
    parents: [systems]
```

## Rules

Topic slugs are kebab-case identifiers. Parent links form a DAG, not a tree. [@topic-models] [@topic-graph]

## Related pages

Read `[[concept-topic-dag]]` and `[[architecture-topic-dag]]`.

