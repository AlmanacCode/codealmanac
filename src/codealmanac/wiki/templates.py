from pathlib import Path


def starter_readme() -> str:
    return """# CodeAlmanac Wiki

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
"""


def starter_topics_yaml() -> str:
    return """topics:
  - slug: concepts
    title: Concepts
    description: Core vocabulary and mental models for this codebase
    parents: []
"""


def starter_page() -> str:
    return """---
title: Getting Started
topics: [concepts]
sources: []
status: active
---

# Getting Started

This starter page marks the wiki as initialized. Replace it with the first
durable reading path for this repository.
"""


def gitignore_runtime_block(almanac_root: Path) -> list[str]:
    root = almanac_root.as_posix().rstrip("/")
    return [
        f"{root}/index.db",
        f"{root}/index.db-wal",
        f"{root}/index.db-shm",
        f"{root}/jobs/",
    ]
