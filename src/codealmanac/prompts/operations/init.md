# Init Operation

Build the first useful wiki for this repository.

Use local files, shell/search commands, and direct writes under the configured
Almanac root. Do not use hosted wiki APIs or external wiki search for init.

## Phase 1: Scan And Plan

Scan the repository as a system, not as a list of files. Inspect the materials
that define how the project works: product docs, architecture notes, public
entrypoints, command or API surfaces, domain modules, workflows, persistence,
integrations, configuration, runtime resources, and tests that encode contracts.

Make a coverage map before writing pages. Write it to `coverage-map.md` in the
configured Almanac root, then treat it as the contract for the rest of the run.
The map should include:

1. `Scan Summary`: what the repo is and the main runtime shape.
2. `Evidence Scanned`: concrete files and directories inspected.
3. `Subject Map`: durable subsystems, workflows, contracts, and decisions found.
4. `Page Inventory`: proposed pages grouped by folder. For each page, include:
   - slug
   - one-sentence purpose
   - key evidence files
   - links it should have to related planned pages
5. `Dropped Or Deferred`: subjects seen but not planned, with reasons.
6. `Coverage Audit`: what the map covers, what risks remain, and whether any
   area is over-compressed.

Choose a complete page inventory from repo evidence. Do not start from a fixed
page list. The folders below are the shape of the wiki, not a checklist.

- `concepts/`: vocabulary pages. Use these for stable ideas a future agent must
  understand before the architecture makes sense.
- `architecture/`: system-shape pages. Use these for subsystems, ownership
  boundaries, runtime flows, adapters, stores, services, workflows, and how
  pieces fit together.
- `guides/`: task pages. Use these only for real procedures a future agent may
  need to perform.
- `decisions/`: decision records. Use these for durable choices stated in docs,
  encoded in tests, or visible in naming and architecture.
- `reference/`: exact lookup pages. Use these for commands, flags, config/state
  paths, schemas, enums, file formats, frontmatter, link syntax, event shapes,
  and other stable contracts.

Do not create `active/`, `_meta/`, or `context/` during init by default.

Split pages by reader need. A subject usually deserves its own page when it has:

- separate owner or module boundary
- public command family or workflow
- storage schema, state enum, ledger, queue, or file format
- external provider adapter or integration contract
- prompt/manual/resource contract
- major test contract
- durable design decision
- operational guide a future agent will actually follow

Do not compress sibling systems into one umbrella page when a future agent would
search for them separately. Related subjects can be separate pages when they
answer different questions and have separate repo evidence.

Do not mirror every file. Do not create pages for implementation details that
only make sense inside one source file. The map should be broad and precise, not
mechanical.

The coverage map is working state and an audit artifact. Do not stop after
planning, and do not create only a report or a starter page. Use the map to
write the wiki in this same run.

Phase 1 and Phase 2 are separate jobs. In Phase 1, create the best coverage map
for the repo. Do not make the map smaller because you will need to write it
later. Do not optimize for speed, brevity, context limits, or ease of completion
while planning.

After Phase 1, freeze the page inventory. Phase 2 must write the frozen
inventory. You may remove a planned page only if you discover it has no repo
evidence or is a true duplicate. If you remove one, update `coverage-map.md`
under `Dropped Or Deferred` with the exact reason. Do not merge planned sibling
pages during Phase 2 for convenience. If two pages are related, write both and
link them.

## Phase 2: Write And Review

Before writing pages, read `manual/README.md`, `manual/how-to-write.md`,
`manual/evidence.md`, `manual/links.md`, and the page-type manuals for the
folders you will create.

Write grounded pages directly under `pages/` from the coverage map. The planned
page inventory is not a suggestion to compress later. Write every planned page
unless you update `coverage-map.md` to move it into `Dropped Or Deferred` with a
repo-evidence reason.

Every page must have a strong lead section. The lead should summarize the whole
article clearly enough that a reader understands the page's subject, purpose,
and main facts before reading the rest.

Use simple, direct prose. Avoid jargon when plain language works. Structure
sections so each next heading feels like the natural next question.

Use inline citations for non-obvious claims. Link related pages with
`[[page-slug]]`, and link relevant files or folders with `[[path/to/file.py]]`
or `[[path/to/folder/]]`.

Create `pages/getting-started.md` as the front door to the finished wiki. If
you draft it early, revise it last so it links only to pages that exist.

Re-read the generated wiki before stopping. Fix weak leads, missing citations,
missing links, duplicate pages, thin placeholders, and obvious coverage gaps.
Compare `coverage-map.md` against the actual files under `pages/` and fix any
missing planned page.

Before stopping, report the planned page count, written page count, and any
dropped pages with reasons. If planned and written counts differ, fix the wiki
before stopping unless every missing page is listed in `Dropped Or Deferred`.

Finish only after the planned pages have been written or deliberately dropped
because the repository evidence did not support them. Do not drop pages for
brevity, convenience, context limits, or because a smaller wiki seems complete
enough.
