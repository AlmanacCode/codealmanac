---
title: Topics DAG And Mutations
topics: [architecture, topics]
sources:
  - id: service
    type: file
    path: src/codealmanac/services/topics/service.py
  - id: graph
    type: file
    path: src/codealmanac/services/topics/graph.py
  - id: mutations
    type: file
    path: src/codealmanac/services/topics/mutations.py
  - id: topic-file
    type: file
    path: src/codealmanac/services/wiki/topic_file.py
---

# Topics DAG And Mutations

Topics are a DAG stored in `topics.yaml` and referenced by page frontmatter. `TopicsService` is the use-case facade for list/show/create/describe/link/unlink/rename/delete, while graph validation, YAML mutation, page frontmatter rewrites, and index refresh live in helper modules [@service] [@mutations].

The graph layer owns topic existence checks, self-parent rejection, and cycle detection [@graph]. The YAML file layer uses ruamel round-trip loading and atomic writes so deterministic topic operations preserve file shape as much as possible [@topic-file].

Use this page with [[wiki-file-format-reference]] when changing topic frontmatter and with [[search-show-health-flow]] when changing topic read behavior.
