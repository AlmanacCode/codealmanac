---
title: Topics YAML
topics: [reference, topics, wiki]
sources:
  - id: topic-models
    type: file
    path: src/codealmanac/services/wiki/topic_models.py
    note: TopicDefinition and TopicsYaml schema.
  - id: topic-file
    type: file
    path: src/codealmanac/services/wiki/topic_file.py
    note: topics.yaml loading, mutation, preservation, and writes.
  - id: topic-graph
    type: file
    path: src/codealmanac/services/topics/graph.py
    note: Parent validation and cycle rejection.
  - id: topic-mutations
    type: file
    path: src/codealmanac/services/topics/mutations.py
    note: Topic mutation behavior and page frontmatter rewrites.
  - id: topics-manual
    type: file
    path: src/codealmanac/manual/topics.md
    note: Topic authoring guidance.
  - id: topic-tests
    type: file
    path: tests/test_topics_mutation.py
    note: Contract tests for preservation, promotion, rename, delete, and malformed files.
  - id: slug
    type: file
    path: src/codealmanac/core/slug.py
    note: Kebab-case topic slug normalization.
---

# Topics YAML

`topics.yaml` is the authored topic-definition file at the root of a CodeAlmanac wiki. It defines topic slugs, titles, descriptions, and parent edges for the wiki's topic DAG; individual pages still attach themselves to topics through page frontmatter [@topic-models]. Together, `topics.yaml` and page `topics:` frontmatter feed the [page graph](../concepts/page-graph).

The file is source, not runtime state. Mutations use round-trip YAML handling so comments and line endings survive ordinary topic commands [@topic-file]. The architecture behind reads and mutations is described in [Topics DAG](../architecture/wiki/topics-dag), and operator steps live in [Maintain topics](../guides/maintain-topics).

## File Shape

The top-level document is a YAML mapping with a `topics` list [@topic-file]. A minimal file is:

```yaml
topics:
  - slug: concepts
    title: Concepts
    parents: []
```

If the file is missing or empty, the loader treats it as an empty mapping and creates an empty `topics` list in memory [@topic-file]. If the top-level YAML value is not a mapping, or `topics` exists but is not a list, loading fails with a validation error [@topic-file].

## Topic Fields

| Field | Required | Meaning |
| --- | --- | --- |
| `slug` | Yes | Canonical topic identifier. |
| `title` | No | Display title; defaults can be derived from the slug. |
| `description` | No | Short topic description. |
| `parents` | No | List of parent topic slugs. |

`TopicDefinition` ignores unknown fields, freezes the parsed model, canonicalizes `slug` through kebab-case, trims non-empty `title` and `description` strings, and treats non-list `parents` values as empty [@topic-models]. Parent entries are also kebab-cased, blank results are dropped, and duplicate parents are removed while preserving first occurrence order [@topic-models] [@slug].

`title_for_slug` derives a display title by capitalizing each hyphen-separated slug part [@topic-models]. Mutation commands use that title when creating missing explicit topic entries [@topic-file] [@topic-mutations].

## Slugs And Parents

Slugs are kebab-case. The shared slug helper lowercases text, replaces runs of non-alphanumeric characters with hyphens, and strips leading or trailing hyphens [@slug]. A topic named `Auth Flow` therefore becomes `auth-flow`.

Parents form a directed acyclic graph. A topic cannot be its own parent, requested parents must already exist for create/link operations, and adding an edge that would create a cycle raises a conflict [@topic-graph]. Ancestor traversal has a defensive depth cap of 32 [@topic-graph].

## Mutation Behavior

Topic commands edit authored files. `create` adds an entry and requested parent edges, `describe` writes or removes the description, `link` and `unlink` edit parent edges, `rename` updates the topic slug and parent references, and `delete` removes the topic and its parent references [@topic-mutations] [@topic-file].

Rename and delete also rewrite page frontmatter where needed. Rename replaces the old topic slug with the new one in page `topics:` lists; delete removes the slug from page `topics:` lists without deleting pages [@topic-mutations] [@topic-tests].

The mutation path promotes ad hoc page-only topics when appropriate. For example, linking or describing a topic that already appears in page frontmatter can create an explicit `topics.yaml` entry for it [@topic-mutations] [@topic-tests].

## Preservation And Failure Rules

`topic_file.py` uses ruamel round-trip YAML mode, preserves quotes, preserves CRLF line endings when present, and writes through a temporary file before replacing `topics.yaml` [@topic-file]. Tests verify that comments survive topic creation and rename operations [@topic-tests].

Malformed `topics.yaml` blocks mutation without overwriting the file [@topic-file] [@topic-tests]. Rename also plans page frontmatter rewrites before changing `topics.yaml`, so malformed page frontmatter can stop the operation before topic YAML is written [@topic-mutations] [@topic-tests].

The topics manual gives the authoring rule behind this schema: use topics for stable retrieval neighborhoods such as subsystems, workflows, command families, storage areas, integrations, and cross-cutting concerns, not for every noun or one-off label [@topics-manual].
