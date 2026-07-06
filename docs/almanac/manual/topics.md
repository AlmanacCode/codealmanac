---
title: Topics
topics: [manual]
---

# Topics

Use topics to make the wiki easy to query and browse.

A page explains one subject. A topic groups pages that belong to the same
reader need, subsystem, workflow, concern, or body of knowledge.

Folders describe page type: `concepts`, `architecture`, `guides`, `decisions`,
and `reference`. Topics describe subject matter. Do not treat folders as the
whole topic system.

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

A good topic is useful for retrieval. If a future maintainer would search for
all pages about that subject, the subject may deserve a topic.

## Topic Size

Do not create a topic for every page. A topic should usually group multiple
pages.

A one-page topic is acceptable when the subject is a clear, stable area that is
likely to grow, or when it is important enough to appear in navigation.

Do not create tiny child topics only because a name appears in one page.

## Topic Parents

Use parent topics to make the graph browsable.

A parent topic should describe a broader neighborhood. A child topic should
describe a narrower subject inside that neighborhood.

Examples of useful parent-child relationships:

- `architecture` -> `cli`
- `architecture` -> `persistence`
- `persistence` -> `sqlite`
- `architecture` -> `harnesses`
- `harnesses` -> provider-specific topics
- `wiki` -> `links`
- `wiki` -> `topics`

A topic may have more than one parent when it genuinely belongs to multiple
neighborhoods. Do not add extra parents just to increase connectivity.

## Topic Names

Use short, stable, reader-facing names.

Prefer names like:

- `cli`
- `sync`
- `sources`
- `harnesses`
- `persistence`
- `viewer`
- `auth`
- `billing`
- `deployment`

Avoid names like:

- `misc`
- `other`
- `utils`
- `new-work`
- `phase-2`
- `refactor`
- names copied directly from one file unless the file name is also the product
  or subsystem name

## Assigning Topics To Pages

Every page should have at least one useful topic.

Use the page-type topic when it helps: `concepts`, `architecture`, `guides`,
`decisions`, or `reference`.

Also add subject topics that place the page in the graph. For example, an
architecture page about a sync workflow might have:

```yaml
topics: [architecture, sync, runs]
```

A reference page about command flags might have:

```yaml
topics: [reference, cli]
```

A decision page about storage might have:

```yaml
topics: [decisions, persistence]
```

Do not overload a page with every related topic. Choose the topics someone would
actually use to retrieve the page.

## During Init

After choosing the page inventory, design `topics.yaml` from the same coverage
map.

The topic graph should reflect the major neighborhoods of the wiki, not just
the folder structure.

Before finishing, check that:

- major subsystems have topics
- cross-folder clusters can be queried by topic
- topics are not mostly one-page labels
- parent-child relationships make browsing easier
- every page has useful topic metadata
