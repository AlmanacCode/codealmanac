# Opinionated Wiki Structure

Date: 2026-07-01

## Purpose

This note records the agreed direction for the next CodeAlmanac wiki shape
before any real wiki pages are written. It is a design brief, not a generated
wiki draft.

The next pass should document the Python rewrite on `dev`, not the older
TypeScript branch. The page inventory must come from reading the Python
codebase and current docs first.

## Writing Standard

Every article starts with a lead paragraph. The lead should explain the whole
page in plain language: what the subject is, why it matters, and where it fits.
If a reader only reads the lead, they should still understand the page's point.

The language should be simple, direct, and easy to translate. Avoid jargon when
a normal word works. Avoid both over-explaining and under-explaining.

Sections should follow the reader's next natural question. A heading should
feel like the next thing the reader wanted to know, not just a label.

Use GitHub Docs-style fundamentals as the model: accurate, accessible,
inclusive, and consistent.

## Decision Page Standard

Decision pages should follow the useful parts of Michael Nygard's Architecture
Decision Record format, adapted for this wiki.

Each decision page records one architecturally significant choice: a choice that
changes structure, dependencies, interfaces, construction technique, lifecycle
behavior, persistence, provider boundaries, or other constraints future work
must understand.

Use this shape:

- Lead: one paragraph that states the decision, why it matters, and where it
  applies.
- Status: proposed, accepted, deprecated, or superseded. If superseded, link to
  the replacement decision.
- Context: neutral facts and forces that made the choice necessary. Include
  tradeoffs and constraints, not persuasion.
- Decision: the chosen response, written in active voice. Prefer "We will ..."
  when describing a current accepted decision.
- Consequences: what changes because of the decision. Include positive,
  negative, and neutral consequences.

Keep decision pages small and modular. One page should explain one decision to
a future maintainer who is trying to decide whether to preserve, extend, or
revisit it. Do not delete reversed decisions; mark them as superseded so the
old rationale remains visible.

## How-To Guide Standard

How-to guides should follow the useful parts of the Diátaxis how-to model,
adapted for maintainers of this codebase.

A how-to guide is for an already-competent reader who knows what they want to
achieve. It should help them solve one real problem or complete one real task,
correctly and safely. It is not a tutorial, concept page, architecture page, or
reference dump.

Use this shape:

- Lead: one paragraph that says what task the guide helps with, when to use it,
  and what result the reader should have at the end.
- Preconditions: what must already be true before the reader starts.
- Steps: a logical sequence of actions. Include judgment points when the right
  action depends on what the reader finds.
- Verification: how the reader knows the task worked.
- Recovery: the most likely failure modes and what to do next.
- Links: point to concept, architecture, decision, or reference pages instead
  of interrupting the guide with background explanation.

Guide titles should name the task directly, such as "Add a source adapter" or
"Debug a failed lifecycle run." Avoid vague nouns like "Source adapters" for a
guide title; those belong in concepts, architecture, or reference.

Keep guides focused on the user's goal, not the tool's menu of operations. Do
not include every related option for completeness. If full option detail matters,
link to a reference page.

## Reference Page Standard

Reference pages should follow the useful parts of the Diátaxis reference model,
adapted for exact CodeAlmanac lookup material.

A reference page describes the machinery as clearly and neutrally as possible.
It is for readers who need truth, certainty, and exact behavior while they are
working. It should not teach a concept, tell the story of an architecture, or
walk through a task.

Use this shape:

- Lead: one paragraph that says what machinery the page describes and when a
  maintainer should consult it.
- Scope: the exact commands, schema, files, flags, states, models, or behavior
  covered by the page.
- Facts: structured tables or lists that mirror the product's own structure.
- Examples: short examples only when they clarify correct usage or shape.
- Warnings: constraints, invalid combinations, edge cases, and must-not rules.
- Links: point to guides for task flow and architecture/concept pages for why
  the machinery exists.

Reference pages should be austere: neutral, objective, factual, precise, and
consistent. They should be organized by the structure of the thing being
described, not by a narrative. Avoid opinions, speculation, motivational prose,
or broad explanations.

## Folder Structure

The initial opinionated structure is:

```text
<almanac-root>/
|-- README.md
|-- topics.yaml
|-- manual/
|-- pages/
    |-- concepts/
    |-- architecture/
    |-- guides/
    |-- decisions/
    |-- reference/
```

The exact filesystem shape may need to follow the current Python root contract.
`MANUAL.md` says the configured Almanac root is flat and contains `README.md`,
`topics.yaml`, `pages/`, and `manual/`. That means the category folders should
probably live under `pages/`, not as peer roots, unless the code changes first.

## Folders

`manual/` explains how to write and maintain the wiki. It holds style,
page-selection, citation, source, and maintenance rules.

`concepts/` explains vocabulary and mental models. These pages define terms a
maintainer needs before reading the deeper architecture.

`architecture/` explains the system. It should cover all meaningful
architecture areas, not a few sampled subsystems.

`guides/` explains recurring maintainer tasks. A guide states the goal, steps,
expected result, and verification.

`decisions/` records settled choices and their rationale. It should not contain
chat-derived preferences unless they became a durable product or architecture
decision.

`reference/` records exact lookup material: commands, flags, config keys,
frontmatter fields, topic YAML, file layout rules, schemas, and stable behavior
tables.

## Folders Not In The Initial Shape

Do not include `active/` initially. Unsettled work should stay in plans,
research notes, or the working branch until it becomes durable knowledge.

Do not include `_meta/` initially. Conventions and maintenance rules should
live in `manual/`.

Do not include `context/` initially. Product, market, competitor, fundraising,
or strategy context can become a folder later if it starts shaping engineering
work often enough.

## Architecture Coverage Standard

Architecture pages should be planned as a full system map before prose is
written. The goal is not "some architecture pages"; the goal is coverage a new
maintainer can use to understand the Python codebase.

Candidate architecture areas to validate against the Python source:

- application composition root
- CLI parser, dispatch, and render layers
- workspace and Almanac root selection
- page model and page services
- topic DAG and tagging
- index storage, projection, search, and health
- lifecycle workflows: build, ingest, garden, sync
- run ledger, job records, locking, and streaming
- harness service and provider adapters
- source runtime and source integrations
- prompt and manual resource loading
- automation scheduler integration
- config service and config stores
- diagnostics and doctor checks
- local server and viewer API
- update/install/platform integrations

This list is not the final page inventory. The real inventory must be decided
after reading the Python source tree and current docs.

## Boundary From The Rejected Draft

The temporary `docs/almanac-opinionated/` draft on the TypeScript branch should
not be treated as source truth. It mixed codebase documentation with chat
preferences and had thin architecture coverage.

Useful ideas from that draft:

- the small folder vocabulary
- lead-first pages
- simple section headings
- reference as exact lookup material

Things not to carry forward:

- a decision page about "no active folder"
- citations to the chat as if they were codebase evidence
- architecture pages written from a partial source scan

## Next Step Before Writing Pages

Before creating the actual wiki pages, inspect the Python codebase and produce
a page inventory for review. The inventory should say which pages belong under
`concepts/`, `architecture/`, `guides/`, `decisions/`, and `reference/`, and
which source files justify each page.
