# Coverage Map Operation

Dev-only prompt for tuning init planning. Use this to design the first wiki's
page inventory without writing the wiki.

## Output

Write one file: `coverage-map.md` in the configured Almanac root.

Do not write or revise pages under `pages/` except for the starter scaffold the
init command already created. Do not create final wiki prose. The output is a
planning artifact only.

## Scan

Stay in planning mode. Do not write article prose. First build the same kind of
map a senior engineer would explain in chat before writing the wiki.

Scan broadly enough to understand the repo as a system, not as a list of files.
Move by subsystem and responsibility. Inspect:

- product docs and architecture docs
- package metadata and public entrypoints
- CLI commands and dispatch/render layers
- services, workflows, stores, integrations, and adapters
- schemas, state machines, ledgers, queues, and file formats
- prompts, manuals, generated scaffolds, and runtime resources
- tests that define public contracts or invariants

Record the important evidence in the map. Prefer concrete file and directory
paths over vague summaries.

As you scan, name the architecture axes out loud in the map: composition root,
CLI edge, services, workflows, integrations, stores, runtime state, prompts,
manuals, viewer/server, cloud/local surfaces, tests, and any repo-specific axes
the code reveals. Architecture should become the spine of the wiki.

## Choose Pages

Scan first, then decide the complete page inventory. Do not start from a fixed
page list. The folders below are the shape of the wiki, not a checklist. Use
the evidence you found in the codebase to decide which pages belong in each
folder.

- `concepts/`: vocabulary pages. Use these for the stable ideas a future agent
  must understand before the architecture makes sense: what a "page", "topic",
  "source", "workspace", "harness", "run", or "Almanac root" means in this
  repo.
- `architecture/`: system-shape pages. Use these for subsystems, ownership
  boundaries, runtime flows, adapters, stores, services, workflows, and how
  pieces fit together.
- `guides/`: task pages. Use these only for real procedures a future agent may
  need to perform, such as adding a command, adding an adapter, debugging a
  failed run, or tracing sync.
- `decisions/`: decision records. Use these for durable choices the repo has
  made, especially choices stated in docs, encoded in tests, or visible in
  naming and architecture.
- `reference/`: exact lookup pages. Use these for commands, flags, config/state
  paths, schemas, enums, file formats, frontmatter, link syntax, event shapes,
  and other stable contracts.

Do not plan `active/`, `_meta/`, or `context/` for init by default.

Split pages by reader need. A subject usually deserves its own page when it has
one of these:

- separate owner or module boundary
- public command family or workflow
- storage schema, state enum, ledger, queue, or file format
- external provider adapter or integration contract
- prompt/manual/resource contract
- major test contract
- durable design decision
- operational guide a future agent will actually follow

Group pages by reader question. Do not split just because the code has a
separate service, workflow, adapter file, or test file. Split only when the
reader would search for the subjects separately or when one page would have to
explain different owners, states, schemas, or flows.

Do not compress sibling systems into one umbrella page when a future agent would
search for them separately. For example, a provider-neutral harness architecture,
a Codex harness, a Claude harness, and normalized harness events may be related,
but they answer different questions and can be separate pages when the repo has
separate evidence for them.

Do not mirror every file. Do not create pages for implementation details that
only make sense inside one source file. The map should be broad and precise, not
mechanical.

Calibrate granularity against a hand-curated first wiki. For a substantial repo,
the first map may contain dozens of pages, but a very large inventory is a smell
unless each page has a distinct reader need. If the inventory grows beyond about
70 pages, audit it for over-splitting and merge pages that would be short,
purely mechanical, or mostly duplicate another page's evidence.

Optimize for coverage. The map should answer: "If a future agent reads this
wiki, which pages would let it understand the whole codebase without repeating
this scan?" If an important subsystem, flow, contract, or decision would be
missing, add a page for it.

## Required Map Shape

`coverage-map.md` must include:

1. `Scan Summary`: what the repo is and the main runtime shape.
2. `Evidence Scanned`: concrete files and directories inspected.
3. `Subject Map`: durable subsystems, workflows, contracts, and decisions found.
4. `Page Inventory`: proposed pages grouped by folder. For each page, include:
   - slug
   - one-sentence purpose
   - key evidence files
   - links it should have to related planned pages
5. `Dropped Or Deferred`: subjects seen but not planned, with reasons.
6. `Coverage Audit`: explain what the map covers, what risks remain, and whether
   any area is over-compressed.

## Quality Bar

A good map lets the writing phase proceed without rediscovering the repo.

Before stopping, review the inventory and fix these problems:

- only one or two architecture pages for a multi-subsystem repo
- umbrella pages that hide separate commands, states, schemas, adapters, or
  provider boundaries
- missing decision pages for choices stated in docs or enforced by tests
- missing reference pages for exact contracts
- concepts that are really architecture pages
- guides that are not task-oriented
- page slugs that are unclear or inconsistent

The goal is not a target count. The goal is enough well-scoped pages that the
first written wiki can approach a hand-curated, gold-standard system wiki.
