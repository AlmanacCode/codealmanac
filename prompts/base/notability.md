# Page Notability And Graph Structure

Use these rules to decide what deserves a page, what deserves a topic, and how
clusters should form. These are judgment tools, not a closed schema.

## Page Existence

A page deserves to exist when it captures durable, reusable project
understanding that would be costly, useful, or risky to reconstruct later.

Good page candidates include:

- **Entity**: a named thing the project reasons about, such as `run`,
  `provider`, `topic`, `stripe`, `postgres`, or `claude-agent-sdk`.
- **Subsystem**: an area with responsibility and boundaries.
- **Flow**: behavior that crosses files, commands, systems, or agents.
- **Contract**: obligations between callers, providers, schemas, APIs,
  commands, file formats, or external services.
- **Data model**: records, schemas, storage formats, indexes, serialized files,
  or external payloads whose shape affects behavior.
- **Operation**: a recurring project or product action with inputs, outputs,
  side effects, and verification.
- **Decision or rationale**: why the project chose one path over plausible
  alternatives.
- **Risk or invariant**: a rule, coupling, assumption, or fragile behavior that
  future work must preserve.
- **Dependency**: an external runtime, service, SDK, API, framework, law,
  platform, or tool as used by this project.
- **Influence**: an external idea, paper, tradition, book, framework, or prior
  art that shaped this project.
- **Research synthesis**: conclusions from docs, papers, experiments, external
  references, or design exploration.
- **Market or product synthesis**: durable understanding about users,
  positioning, pricing, competitors, sentiment, or product strategy.
- **Incident or postmortem**: what happened, what was learned, and what changed.
- **Hub**: a navigational page that explains a dense cluster.

Genres are vocabulary, not enforcement. Create a different shape when the
material genuinely needs it.

## What Usually Does Not Deserve A Page

Avoid pages that are only:

- file-by-file summaries
- folder trees in prose
- raw transcripts
- generic API documentation copied from an external source
- task progress logs
- roadmaps that belong in an issue tracker
- guesses about intent that the repo or sources do not support
- one-off facts obvious from one nearby file
- date-stamped notes with no synthesis value
- pages whose only claim is that something exists

If the useful part of an input can be folded into an existing synthesis page,
do that instead of creating a new page.

## Entities

Entity pages are first-class. Use the natural name as the slug when possible:
`stripe.md`, `postgres.md`, `run.md`, `topic.md`, `claude-agent-sdk.md`.

An entity page should explain:

- what the entity means in this project
- where it is represented in code, docs, config, or external systems
- who creates, reads, mutates, or depends on it
- what states, versions, or variants matter
- what assumptions and constraints surround it
- what related pages a future agent should read next

External entity pages are not encyclopedia entries. They describe the entity's
role in this project.

## Topics And Clusters

Topics are reading neighborhoods. A topic should help answer: what should an
agent read together?

Good topics name stable areas of meaning:

- `provider-harness`
- `prompt-system`
- `wiki-indexing`
- `agent-tools-market`
- `product-positioning`
- `claude-agent-sdk`
- `pricing`

Bad topics are bookkeeping labels:

- `misc`
- `notes`
- `research`
- `external`
- exact filenames
- dates by default

Prefer existing topics. Create a topic when several pages now form a real
cluster or a new cluster is clearly expected to grow.

## Hubs

A hub exists when search results are no longer enough to understand a cluster.

A hub should explain:

- what the cluster is
- which pages are core
- what a new agent should read first
- how the pages relate
- which pages are current synthesis and which are historical context
- what tensions, open questions, or major changes shape the area

Small clusters do not need separate hub pages. The main entity or subsystem
page can act as the local hub until navigation becomes unclear.

## Splitting And Merging

Use summary style. A page may start broad. When a section grows into an
independently useful concept, split it into its own page and leave a short
summary plus link on the original page.

Split when:

- a section has its own internal structure
- other pages want to link to that section specifically
- incidents, decisions, or docs cluster around a subtopic
- a page is doing multiple unrelated jobs

Merge when:

- two pages answer the same future-agent question
- one page is only a stub pointing to another
- a set of date-stamped fragments should become an evolving synthesis page

Archive or supersede when knowledge is no longer current but remains useful as
history. Delete only when the page has no durable value.
