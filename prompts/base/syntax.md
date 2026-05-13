# Page Syntax And Writing Conventions

Write markdown pages directly under `.almanac/pages/`. Use kebab-case slugs.
The filename is the stable page identity.

Use natural names. Prefer `stripe.md`, `postgres.md`,
`claude-agent-sdk.md`, `agent-tools-market.md`, and
`pricing-sensitivity.md` over genre-prefixed names such as
`dependency-stripe.md` or `research-agent-tools-market.md`.

## Frontmatter

Use YAML frontmatter when it helps indexing and future agents.

Common fields:

```yaml
---
title: Human Readable Title
summary: One direct sentence explaining what this page helps future agents understand.
topics: [topic-one, topic-two]
files:
  - src/path/to/file.ts
sources:
  - https://example.com/docs
status: active
verified: 2026-05-10
external_version: "api-or-doc-version-if-relevant"
supersedes: old-page-slug
superseded_by: new-page-slug
archived_at: 2026-05-10
---
```

`title`, `summary`, `topics`, `files`, `archived_at`, `supersedes`, and
`superseded_by` are understood by current tooling. Other fields are allowed as
durable prompt-level conventions and future index inputs.

Use `summary:` as the page's search-result snippet: one factual sentence,
not a paragraph, explaining what the page is about and why an agent would
open it.

Use `files:` for repo files and folders that support the page. Use `sources:`
for external docs, papers, URLs, transcripts, notes, market reads, research
inputs, commits, or other non-repo material that supports the page.

Do not add fields mechanically. Frontmatter should make the page more
retrievable, grounded, or maintainable.

## Wikilinks

Use one `[[...]]` syntax:

- `[[page-slug]]` links to another wiki page.
- `[[src/indexer/schema.ts]]` references a repo file.
- `[[src/indexer/]]` references a repo folder.
- `[[other-wiki:page-slug]]` references another wiki.

Disambiguation is content-based:

- contains `:` before `/` means cross-wiki
- contains `/` means file or folder
- trailing `/` means folder
- otherwise it is a page slug

Link the first meaningful mention of a related page in a section. Do not link
every repeated word. A page with no inbound or outbound links is suspect.

## Grounding

Ground non-obvious claims in code, tests, docs, sources, commits, prior wiki
pages, or explicit user-provided context.

Do not pretend uncertainty is fact. If a claim matters and cannot be grounded,
either omit it or mark it as an open question.

For external docs or research, cite the source and preserve the conclusion that
matters to this project. Do not copy long external passages into the wiki.

For code claims, prefer exact file references in `files:` and links in prose.
For behavior claims, inspect tests when available.

## Page Shape

Start with a lead. The lead should stand alone: a future agent should know what
the page is about, why it exists, and whether to keep reading.

After the lead, use sections based on the page's job. Common sections include:

- What it is in this project
- Where it lives
- How it works
- What we use
- What we do not use
- Contracts and assumptions
- Related flows
- Current synthesis
- Open questions
- Verification
- Related pages

Use prose for explanation. Use bullets for real lists. Use tables only for
structured comparison.

## Style

Be direct, factual, and dense. Write for future coding agents.

Avoid:

- generic library tutorials
- vague claims
- marketing prose
- unsupported rationale
- transcript language
- "this file contains" summaries
- conclusions that do not connect to future work

Every edit should make the graph easier to understand, navigate, or trust.

## Source Control Hygiene

Before finishing a successful Build, Absorb, or Garden run, check whether you
created, changed, archived, deleted, or retopiced wiki source files. Wiki source
files are `.almanac/README.md`, `.almanac/pages/`, and `.almanac/topics.yaml`.

Only create a git commit when the runtime context says auto-commit is enabled.
When it is enabled, commit only those wiki source changes and use the commit
message shape `almanac: <short summary>`.

When auto-commit is disabled, do not create a git commit. Leave wiki source
changes in the working tree for the user to review.

Do not commit `.almanac/runs/`, `.almanac/index.db`, provider logs, unrelated
repo edits, or pre-existing user changes. If there are no durable wiki content
changes, do not create a commit.
