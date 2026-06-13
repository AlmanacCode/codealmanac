# Page Syntax And Writing Conventions

Write readable wiki pages under `docs/almanac/`. Use nested folders for the
primary browse structure. Use stable `page_id` values so links survive file
moves and `README.md` pages can exist in multiple folders.

## Frontmatter

Use a small YAML frontmatter block for identity, retrieval, and evidence:

```yaml
---
page_id: provider-harness
title: Provider Harness
topics: [architecture, agents]
sources:
  - id: provider-registry
    type: file
    path: src/agent/providers/index.ts
    note: Shows how providers register runtime metadata and execution behavior.
  - id: codex-decision
    type: wiki
    slug: codex-sdk-spike
    note: Records why the Codex app-server path replaced the SDK spike.
---
```

`page_id`, `title`, `topics`, and `sources` are the normal fields for new
pages. `summary` is optional; the lead should usually do the summary work.

`page_id` is the stable wiki identity. It should be kebab-case and unique across
the wiki, independent of the file path.

Use `sources:` for evidence. Use `type: file` for repo files, tests, prompts,
migrations, and config; `type: wiki` for existing wiki pages; `type: web` for
external docs; and other clear types for PRs, issues, commits, conversations,
research notes, or market reads. Every source needs a stable `id` and a `note`
explaining what it supports.

Cite non-obvious claims with `[@source-id]`. Do not cite a source you did not
inspect. Citations are evidence; wikilinks are navigation.

Legacy `.almanac/pages/` content and legacy `files:` frontmatter may still
exist during migration. Do not create new legacy pages unless you are explicitly
maintaining an old-layout repo.

## Wikilinks

Use one `[[...]]` syntax:

- `[[provider-harness]]` links to another wiki page.
- `[[src/agent/providers/index.ts]]` references a repo file.
- `[[src/agent/providers/]]` references a repo folder.
- `[[other-wiki:provider-harness]]` references another wiki.

Use `[[page-id|readable text]]` when slug-only text would interrupt the
sentence. Link the first meaningful mention of a related page in a section.

Links need context. The surrounding sentence should say why the reader might
follow the link. Do not add decorative links that do not clarify a relationship.

## Page Shape

Start with a lead. The lead should stand alone for a reader who landed from
search: what this subject is, why it matters to the repo, and what the page
will help them understand.

Use sections that fit the subject. Common sections include:

- What it is
- Where it lives
- How it works
- Runtime flow
- Public contract
- Current shape
- History
- Decisions and constraints
- Failure modes
- How to change it safely
- Source limits
- Related pages

Do not force every page through every section. A small decision page and a
major subsystem page need different shapes.

## Writing Standard

Write for humans first, with enough specificity for agents to verify.

- Every paragraph should contain concrete project facts.
- Prefer prose. Use bullets for real lists and tables for structured
  comparison.
- Use direct neutral language. Avoid marketing, filler, and vague importance
  claims.
- Do not speculate. If the source does not establish why something exists, say
  what is known or omit the claim.
- Preserve useful history in prose when it explains the current shape.
- Make conflicts visible when sources disagree.
- Keep sections self-contained enough to survive retrieval without the whole
  page.

## Source Control Hygiene

Before finishing a successful Build, Absorb, or Garden run, check whether you
created, changed, deleted, retopiced, or moved durable wiki source files.

Wiki source files are:

- `docs/almanac/`
- `.almanac/review.yaml`
- legacy `.almanac/pages/` and `.almanac/topics.yaml` only when maintaining an
  old-layout repo

Only create a git commit when the runtime context says auto-commit is enabled.
When it is enabled, commit only wiki source changes and use:

```text
almanac: <imperative one-line summary>

<optional body explaining what changed and why>
```

Do not commit `.almanac/index.db`, `.almanac/runs/`, `.almanac/jobs/`, provider
logs, unrelated repo edits, or pre-existing user changes.
