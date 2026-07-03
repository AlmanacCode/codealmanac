# CodeAlmanac Wiki

This is the living wiki for this repository. It records the durable knowledge
the code cannot say: decisions, flows, invariants, incidents, gotchas, and
project context that future agents should not rediscover from scratch.

## Notability Bar

Write a page when it preserves non-obvious knowledge that will help a future
agent work safely in this codebase.

Good pages explain:

- a decision that took research or trial-and-error
- a cross-file flow
- an invariant or gotcha not visible from one file
- an external dependency as this repo uses it
- a product or operational constraint that shapes future work

Do not write pages that restate nearby code.

## Topic Taxonomy

Topics live in `topics.yaml`. Pages live in `pages/`.

The default first-build page neighborhoods are:

- `pages/concepts/`
- `pages/architecture/`
- `pages/guides/`
- `pages/decisions/`
- `pages/reference/`

Those two entries are the source markers for an initialized CodeAlmanac wiki.
`README.md` guides writers, but it is not a marker by itself.

## Manual

Read `manual/README.md` before creating, reorganizing, or substantially
rewriting pages. The manual is bundled with CodeAlmanac and copied here by
`codealmanac init`.

## Links

Use `[[page-slug]]` for page links and `[[src/path.py]]` for file references.

## Writing Standard

Write clear product documentation. Every article starts with a lead paragraph
that summarizes the page's main story. Use simple, direct language and cite
non-obvious claims inline with `[@source-id]`.

Read `manual/how-to-write.md`, `manual/evidence.md`, and `manual/links.md`
before writing substantial pages. Read the relevant page-type manuals before
writing concepts, architecture, guides, decisions, or reference pages.
