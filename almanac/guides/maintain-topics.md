---
title: Maintain Topics
topics: [guides, wiki, topics]
sources:
  - id: topics-manual
    type: file
    path: src/codealmanac/manual/topics.md
    note: Manual standard for topic design and page topic metadata.
  - id: wiki-parser
    type: file
    path: src/codealmanac/cli/parser/wiki.py
    note: Public topic, tag, and untag command surface.
  - id: topics-dispatch
    type: file
    path: src/codealmanac/cli/dispatch/topics.py
    note: CLI-to-request mapping for topic commands.
  - id: wiki-dispatch
    type: file
    path: src/codealmanac/cli/dispatch/wiki.py
    note: Wiki command dispatch for topics, tag, and untag.
  - id: topics-service
    type: file
    path: src/codealmanac/services/topics/service.py
    note: Topic service facade for reads and mutations.
  - id: topic-mutations
    type: file
    path: src/codealmanac/services/topics/mutations.py
    note: Topic mutation executor, YAML writes, page rewrites, and index refresh.
  - id: topic-graph
    type: file
    path: src/codealmanac/services/topics/graph.py
    note: Parent validation and cycle rejection.
  - id: topic-file
    type: file
    path: src/codealmanac/services/wiki/topic_file.py
    note: Round-trip topics.yaml mutation support.
  - id: tagging-service
    type: file
    path: src/codealmanac/services/tagging/service.py
    note: Page topic frontmatter tag and untag behavior.
  - id: topic-tests
    type: file
    path: tests/test_topics_mutation.py
    note: Topic mutation and rewrite safety tests.
---

# Maintain Topics

Use this guide when adding, renaming, linking, deleting, or assigning wiki topics. Topics are the subject graph for the wiki. They are separate from folders: folders describe page type, while topics group pages by subsystem, workflow, command family, storage area, integration boundary, provider family, or recurring task [@topics-manual].

The safe outcome is that `almanac/topics.yaml` still describes a directed acyclic graph, page frontmatter still has useful `topics:`, and the local index can rebuild the graph. Prefer the topic commands for graph changes because they preserve YAML comments, rewrite page frontmatter when needed, reject cycles, and refresh the index [@topic-mutations] [@topic-file]. Background architecture is in [Topics DAG](../architecture/wiki/topics-dag), [topics.yaml](../reference/topics-yaml), and [Page graph](../concepts/page-graph).

## Choose The Topic Shape

Create a topic only when it helps future readers retrieve related pages. Good topics are stable reader-facing names such as `cli`, `sources`, `harnesses`, `persistence`, `wiki`, or `topics` [@topics-manual].

Do not create a topic for every page. A one-page topic is acceptable when it is a stable area likely to grow or important enough for navigation, but most topics should group more than one page [@topics-manual].

Use parent topics to make browsing easier. A child should be a narrower subject inside the parent. A topic can have multiple parents when that is genuinely useful, but extra parents should not be added just to increase connectivity [@topics-manual].

## Use The Topic Commands

The public wiki parser exposes `codealmanac topics`, with subcommands for `show`, `create`, `describe`, `link`, `unlink`, `rename`, and `delete` [@wiki-parser]. It also exposes `codealmanac tag` and `codealmanac untag` for page-level topic frontmatter [@wiki-parser].

Use the graph commands for graph metadata:

```bash
codealmanac topics create "Sources" --parent architecture
codealmanac topics describe sources "Source input and runtime material"
codealmanac topics link github sources
codealmanac topics unlink github sources
codealmanac topics rename old-slug new-slug
codealmanac topics delete obsolete-slug
```

Use page tagging commands when the page assignment is the only change:

```bash
codealmanac tag guides/maintain-topics wiki topics
codealmanac untag guides/maintain-topics old-topic
```

Dispatch turns those CLI calls into typed topic requests before calling the service [@topics-dispatch] [@wiki-dispatch]. That keeps command parsing separate from mutation behavior.

## Understand What Mutates

`TopicsService` is the facade. Reads come from the index, and writes delegate to `TopicMutationExecutor` [@topics-service]. The executor resolves the repository, loads `topics.yaml`, applies the requested mutation, writes the file, and refreshes the index [@topic-mutations].

`create`, `describe`, `link`, and `unlink` mostly change `topics.yaml`. `rename` and `delete` are wider because page frontmatter can contain the changed topic. Rename rewrites matching page topics to the new slug; delete removes the topic from page frontmatter without deleting pages [@topic-mutations] [@topic-tests].

`tag` and `untag` operate on one page. They load the page through `PagesService`, compute the new topic tuple, and rewrite that page's frontmatter [@tagging-service].

## Keep The DAG Valid

Before adding parent edges, the graph layer validates that parents exist, rejects self-parent links, and rejects cycles [@topic-graph]. Cycle detection walks ancestors with a depth cap of 32, which protects the command path if the graph is already unusual [@topic-graph].

If a command refuses a parent or reports that a link would create a cycle, fix the topic design rather than editing around the command. The command is protecting the browse graph.

## Verify The Change

After topic maintenance, inspect the result:

```bash
codealmanac topics show <slug> --descendants
codealmanac search --topic <slug>
codealmanac health
codealmanac validate
```

For code changes in this area, run:

```bash
uv run pytest tests/test_topics_mutation.py
uv run pytest tests/test_architecture.py
uv run ruff check .
```

The tests cover comment preservation, missing-parent refusal, cycle rejection, rename rewrites, delete rewrites, malformed YAML failures, and malformed page-frontmatter failures before `topics.yaml` is written [@topic-tests].
