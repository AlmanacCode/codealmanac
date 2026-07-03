---
title: How To Write
topics: [manual]
---

# How To Write

Write pages in plain, direct language. A good page is easy to read without
being thin. It gives the reader enough context to understand the subject, why it
exists in this repo, and how it fits into the surrounding system.

This manual is the general writing standard for every page. Use it together
with the page-specific manual for the folder you are writing in:
`manual/concepts.md`, `manual/architecture.md`, `manual/how-to-guides.md`,
`manual/decisions.md`, or `manual/reference.md`.

Do not rely on generic documentation slogans. Write the page so a future agent
can build a working model of the repo faster than it could by opening raw files.

## Lead Paragraph

Every article starts with a lead. The lead is a compact summary of the whole
article, not a teaser and not just a definition. After reading the lead, a
reader should know what the page is about, the main facts the page explains,
why the subject matters in this repo, and what role it plays in the surrounding
system.

This is very similar in idea to Lead paragraphs in a Wikipedia article.

Short pages often need one lead paragraph. Longer pages may need two or more.
Keep the lead tight, but do not make it skeletal. A lead that only says "this
page documents X" is too weak.

## Section Flow

You should structure your article into sections and subsections.

Write each page as a coherent article, not a pile of notes. The page should
have a clear through line: the lead summarizes the whole subject, each section
develops one part of that subject, and later sections build on earlier sections
without simply repeating them.

Use sections and subsections to organize the article. A heading should mark a
real turn in the explanation: a new part of the system, a new stage in the flow,
a reason behind a decision, or a contract the reader needs to understand.

Do not add sections because a template says so. Add them because the article
needs that shape to explain the subject clearly.

## Language

Prefer short factual sentences. Use "is" when it fits. Avoid inflated verbs
such as "facilitates", "leverages", and "utilizes".

Avoid promotional language, speculation, unexplained acronyms, generic
architecture prose, filler introductions, and formulaic conclusions.

Do not write generic sentences that could describe any codebase. Tie the prose
to this repository's commands, files, workflows, contracts, decisions, or
runtime behavior.

Use prose first. Use bullets for real lists or ordered procedures. Use tables
when structure makes comparison easier. A dense bullet list is not a substitute
for explaining the subject.

## Page Shape

Most pages should include enough connective tissue to orient the reader:

- Concept pages define the term, explain why it matters here, and point to the
  architecture pages that use it.
- Architecture pages explain ownership, entrypoints, flow, dependencies,
  invariants, and what depends on the area.
- Guides state when to use the guide, the expected outcome, preconditions,
  ordered steps, verification, and recovery notes when the task has common
  failure modes.
- Decision pages state the status, context, decision, and consequences.
- Reference pages define their lookup scope, then organize exact commands,
  fields, states, schemas, or formats in a scannable way.

These are page shapes, not mandatory headings. Use the shape when it helps the
reader.
