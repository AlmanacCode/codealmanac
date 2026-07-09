# Build Operation

Build the first useful wiki for this repository.

Use local files, shell/search commands, and direct writes under `almanac/`. Do
not use hosted wiki APIs or external wiki search for build.

## Phase 1: Scan And Plan

Scan the repository as a system before writing pages. Inspect the materials that
define how the project works: docs, entrypoints, command or API surfaces,
domain modules, workflows, persistence, integrations, configuration, runtime
resources, prompts, manuals, and tests.

Use read-only research sub-agents during Phase 1. Assign them independent parts
of the codebase so the scan is broader than one agent's linear pass. Good
research slices include docs, command surfaces, services/workflows,
integrations, persistence, runtime resources, prompts/manuals, and tests.

The main agent owns the final coverage map. It must synthesize sub-agent
findings, remove duplicates, resolve overlaps, and decide the final page
inventory.

Make a coverage map before writing pages. Write it to
`almanac/coverage-map.md`, then treat it as the contract for the rest of the
run.

Write `coverage-map.md` with valid page frontmatter:

```yaml
---
title: Coverage Map
summary: Frozen page inventory for this first wiki build.
topics: [build, wiki, reference]
sources: []
---
```

Even though `coverage-map.md` is working state, it lives under `almanac/` and
must pass normal page validation.

Write `coverage-map.md` with one main section:

## Page Inventory

Group planned pages by folder and subfolder. For each page include:

- path
- slug
- one-sentence purpose
- planned links to nearby pages
- key evidence files only when they help the writing sub-agent start faster

The top-level folders are page types: `concepts/`, `architecture/`, `guides/`,
`decisions/`, and `reference/`.

Within each page-type folder, use subfolders when they make the wiki easier to
browse. Subfolders are for filesystem navigation. Topics are for query and
cross-folder relationships. Do not treat subfolders as a replacement for
`topics.yaml`.

Create subfolders from the repo's actual subject neighborhoods, not from a
fixed list. Good subfolders often come from workflows, command surfaces,
persistence, provider adapters, runtime resources, schemas, or other recurring
areas in the repository.

Do not create `active/`, `_meta/`, or `context/` during build by default.

Do not mirror every file. Do not create pages for implementation details that
only make sense inside one source file. The map should be broad and precise, not
mechanical.

The coverage map is working state and an audit artifact. Do not stop after
planning, and do not create only a report or a starter page. Use the map to
write the wiki in this same run.

Phase 1 and Phase 2 are separate phases. In Phase 1, create the best coverage map
for the repo. Do not make the map smaller because you will need to write it
later. Do not optimize for speed, brevity, context limits, or ease of completion
while planning.

After Phase 1, freeze the page inventory. Phase 2 must write the frozen
inventory. Do not merge planned sibling pages during Phase 2 for convenience. If
a page is removed, update `coverage-map.md` with the exact repo-evidence reason.

## Phase 2: Write And Review

Before writing pages, use the bundled manual text in the runtime context.

Use `how-to-write.md`, `evidence.md`, and `links.md` from the manual context
for every page.

Use `topics.md` from the manual context when assigning page `topics:`
frontmatter and when finalizing `almanac/topics.yaml`.

Before writing each page, use the manual that matches that page's folder:

- `concepts/` pages use `concepts.md`
- `architecture/` pages use `architecture.md`
- `guides/` pages use `how-to-guides.md`
- `decisions/` pages use `decisions.md`
- `reference/` pages use `reference.md`

Use writing sub-agents to draft the wiki pages. This is required for
non-trivial first wikis.

The main agent is the orchestrator, not an article writer. The main agent may
write `coverage-map.md`, inspect files, spawn writing sub-agents, run audits,
and revise `topics.yaml`. The main agent must not create or substantially edit
article files under `almanac/` directly. Every article page, including
`almanac/getting-started.md`, must be assigned to a writing sub-agent.
All article writing must be done by writing sub-agents. The main agent must not
write article drafts, fill missing pages, or perform substantive article
rewrites itself.

If review finds a weak lead, missing citation, broken link, thin section,
duplicate explanation, wrong folder, or missing planned page, the main agent
should dispatch a repair sub-agent with the exact page files and fixes needed.
Do not handle substantive article rewrites in the main agent.

Assign each writing sub-agent a small, non-overlapping batch of pages from the
coverage map. Use batches of up to five related pages per writing sub-agent.
Most non-trivial first wikis will need multiple waves. Continue dispatching
writing batches until every planned page in the frozen Page Inventory has an
owning sub-agent. Each sub-agent owns only its assigned pages.

For each writing batch, give the sub-agent a prompt in this shape:

"""
These are the topics that you have to write on:
- <Topic 1> -> <path 1>
- <Topic 2> -> <path 2>
- <Topic 3> -> <path 3>

Based on this codebase, write Wikipedia articles on these particular pages.
Also read the provided <how-to-write.md>, <evidence.md>, <links.md>, and the
relevant folder manuals before writing. Use the repository at <repo-root> as
source material.
Output complete Markdown pages at the assigned paths.

Write only the assigned paths.
"""

For each writing sub-agent, provide:

- the exact page paths and slugs it must write
- the relevant entries from `coverage-map.md`
- the folder-specific manual for those pages
- `how-to-write.md`
- `evidence.md`
- `links.md`
- the evidence files listed for those pages
- the planned links to nearby pages

Do not summarize, paraphrase, or compress the manual guidance when prompting
writing sub-agents. Include the relevant manual text directly in the sub-agent
prompt, including `how-to-write.md`, `evidence.md`, `links.md`, and every
folder-specific manual needed for that batch.

Every writing sub-agent prompt must include the exact source frontmatter shape:

```yaml
sources:
  - id: source-id
    type: file
    path: path/to/file.py
```

Use `type`, not `kind`. Directory evidence is still `type: file`; mark it with a
trailing slash in `path`.

When a batch contains pages from different folders, include every relevant
folder-specific manual in the sub-agent prompt.

A writing batch is not fully assigned until its sub-agent prompt includes the
full manual packet and the exact source schema example.

The sub-agent's task is to write encyclopedia-quality articles about this
codebase. Each page should feel like a focused Wikipedia article for one
codebase subject: it should define the subject, explain why it exists here, show
how it works, connect it to related pages, and cite the code or docs that
support the claims.

Do not write thin component summaries. Do not merely restate filenames. Do not
write a checklist. Do justice to the subject as a real article.

Each writing sub-agent must:

- write only its assigned files under `almanac/`
- follow the folder-specific manual for each page
- write a strong lead paragraph that summarizes the whole article
- use simple, direct language
- include inline citations for factual claims
- add useful Markdown links to related planned or existing pages
- keep the article coherent even when using bullets or tables
- avoid changing `coverage-map.md`, `topics.yaml`, `README.md`, or pages
  assigned to another sub-agent

Have writing sub-agents write grounded pages directly under `almanac/` from the
coverage map. The planned page inventory is not a suggestion to compress later.
Write every planned page unless you update `coverage-map.md` with the exact
repo-evidence reason the page was removed.

Every page must have a strong lead section. The lead should summarize the whole
article clearly enough that a reader understands the page's subject, purpose,
and main facts before reading the rest.

Use simple, direct prose. Avoid jargon when plain language works. Structure
sections so each page has a clear through line and later sections build on
earlier sections without simply repeating them.

Use inline citations for non-obvious claims. Put only cited evidence in
`sources:` frontmatter entries. Do not use `sources:` as a context list or
bibliography. Every `sources:` entry must be cited in the page body with
`[@source-id]`, or removed. Directory source paths must end with `/`.

Assign `almanac/getting-started.md` to a writing sub-agent as the front door to
the finished wiki. If it is drafted early, send it back to a writing or repair
sub-agent near the end so it links only to pages that exist.

After writing the pages, build or revise `topics.yaml` from the actual page set.
Treat page frontmatter as evidence: look at the subjects that recur across
concepts, architecture, guides, decisions, and reference pages. Create topics
for real query neighborhoods, not for every page. The final topic graph may
differ from the Phase 1 Topic Sketch. Prefer the topics that best organize the
written wiki.

Re-read the generated wiki before stopping. Fix weak leads, missing citations,
missing links, duplicate pages, thin placeholders, and obvious coverage gaps.
Compare `coverage-map.md` against the actual files under `almanac/` and fix any
missing planned page.

After all writing sub-agents finish, the main agent owns the final wiki's
coherence. Review the whole wiki before stopping. For missing planned pages,
weak or incomplete leads, pages that are only lists or component summaries,
missing citations, missing links between related pages, duplicate or overlapping
explanations, terminology drift, or wrong folder placement, dispatch repair
sub-agents with the exact pages and changes needed.

Run `codealmanac validate` before committing. If validation fails, do not commit.
Fix validation issues first, rerun validation, and commit only after validation
passes.

Before stopping, make sure every missing planned page has an exact
repo-evidence removal reason in `coverage-map.md`, or write the missing page.

Finish only after the planned pages have been written or deliberately dropped
because the repository evidence did not support them. Do not drop pages for
brevity, convenience, context limits, or because a smaller wiki seems complete
enough.
