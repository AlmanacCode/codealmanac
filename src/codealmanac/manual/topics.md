---
title: Topics
topics: [manual]
---

# Topics

Use topics to make the wiki easy to query and browse.

A page explains one subject. A topic groups pages that belong to the same
reader need, subsystem, workflow, concern, or body of knowledge.

Folders describe browseable neighborhoods. Topics describe subject matter. Do
not treat folders as the whole topic system.

## What Makes A Good Topic

Create a topic when it helps a future reader find related pages together.

Good topics usually name:

- a subsystem
- a workflow
- a command family or public surface
- a storage area or schema family
- an integration boundary
- a provider or adapter family
- a cross-cutting concern
- a product area
- a recurring operational task

A good topic is stable. It should still make sense after individual files move
or implementation details change.

## Topic Size

Do not create a topic for every page. A topic should usually group multiple
pages.

A one-page topic is acceptable when the subject is a clear, stable area that is
likely to grow, or when it is important enough to appear in navigation.

## Assigning Topics To Pages

Every page should have at least one useful topic.

Use page-family topics when they help: `concepts`, `architecture`, `guides`,
`decisions`, or `reference`.

Also add subject topics that place the page in the graph. For example, an
architecture page about a sync workflow might have:

```yaml
topics: [architecture, sync, runs]
```

Do not overload a page with every related topic. Choose the topics someone
would actually use to retrieve the page.
