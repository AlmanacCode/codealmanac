---
title: Topics DAG
topics: [architecture, wiki, topics]
sources:
  - id: topics-service
    type: file
    path: src/codealmanac/services/topics/service.py
    note: Service facade for topic reads and mutation verbs.
  - id: topic-mutations
    type: file
    path: src/codealmanac/services/topics/mutations.py
    note: Topic mutation executor and index refresh behavior.
  - id: topic-graph
    type: file
    path: src/codealmanac/services/topics/graph.py
    note: Parent validation and cycle detection.
  - id: topic-file
    type: file
    path: src/codealmanac/services/wiki/topic_file.py
    note: Round-trip topics.yaml mutation path.
  - id: topic-tests
    type: file
    path: tests/test_topics_mutation.py
    note: Topic mutation safety and rewrite behavior.
  - id: live-agreement
    type: file
    path: docs/python-port-live-agreement.md
    note: Active split between topic orchestration, graph mechanics, and YAML mutation.
---

# Topics DAG

The topics DAG is the browseable topic graph for a repo wiki. It is built from `almanac/topics.yaml` plus page `topics:` frontmatter, and it gives pages a subject map that is separate from the folder tree. The graph is a directed acyclic graph: a topic may have parents, but parent links cannot form a cycle [@topic-graph]. The exact YAML shape is documented in [Topics YAML](../../reference/topics-yaml), and maintainer steps live in [Maintain topics](../../guides/maintain-topics).

This area is split into read and write responsibilities. `TopicsService` is the service-facing facade for list, show, create, describe, link, unlink, rename, and delete [@topics-service]. The mutation executor owns file writes, page frontmatter rewrites, graph checks, and index refresh after topic changes [@topic-mutations]. That split keeps topic commands deterministic while the derived index remains the read model.

## Read Shape

Topic reads come from the index. `list` selects the repository and returns indexed topic summaries, while `show` kebab-cases the requested slug and asks the index for a `TopicDetail` [@topics-service]. This means callers do not parse `topics.yaml` directly during normal reads.

The index can see two kinds of topic evidence. A topic can be defined in `topics.yaml`, or it can appear only in page frontmatter. Mutation commands call the index for existing topic slugs before deciding whether a topic exists, which lets commands promote page-only topics into explicit YAML entries when needed [@topic-mutations] [@topic-tests].

## Mutation Flow

Topic mutations write the authored wiki files, not a hidden graph store. `create` loads `topics.yaml`, validates requested parents, creates the child entry, adds parent edges, writes the file, and refreshes the index [@topic-mutations]. `link` and `unlink` edit only parent edges. `describe` stores or removes a description on the topic entry [@topic-mutations].

Rename and delete are wider changes because page frontmatter may mention the topic. Rename plans page topic rewrites, updates the topic slug and parent references in `topics.yaml`, writes the topic file, applies the page rewrites, and refreshes the index [@topic-mutations]. Delete removes the topic from `topics.yaml`, removes matching parent edges, removes that topic from page frontmatter, and does not delete pages [@topic-file] [@topic-tests].

## YAML Preservation

`topic_file.py` uses ruamel's round-trip YAML mode for mutation writes. It preserves comments and line endings, creates missing `topics:` lists, validates the parsed structure through the topic model, and writes through a temporary file before replacing `topics.yaml` [@topic-file].

The tests lock down that behavior. Creating a topic preserves existing comments, malformed `topics.yaml` fails without overwriting the file, and malformed page frontmatter blocks a rename before `topics.yaml` is changed [@topic-tests]. This matters because `topics.yaml` is committed source, not disposable runtime state.

## Cycle Prevention

The graph layer prevents self-parent links and missing-parent links before mutation writes [@topic-graph]. When an edge is added, `reject_cycle` checks whether the child is already an ancestor of the proposed parent. If it is, the operation raises a conflict instead of writing the edge [@topic-graph].

Ancestor traversal has a depth cap of 32 [@topic-graph]. The cap is defensive: valid topic graphs should be much shallower, and the mutation path should not risk unbounded traversal if the file is already strange.

## Architectural Boundary

The live agreement makes this split explicit: topic read orchestration, graph mechanics, repository selection, and `topics.yaml` mutation each have their own modules [@live-agreement]. The point is not just smaller files. It lets future changes extend the topic model without mixing repository lookup, index reads, YAML preservation, page rewrites, and DAG validation in one place.

When changing this area, keep that boundary intact. Reads should stay index-backed. Mutations should update authored Markdown/YAML, refresh the index, and reject graph shapes that would make topic browsing ambiguous.

For task steps, use [Maintain topics](../../guides/maintain-topics). For the exact `topics.yaml` schema and mutation contract, use [Topics YAML](../../reference/topics-yaml).

After changing topic source, verify the graph with [Verify a wiki change](../../guides/verify-a-wiki-change).
