# Docs Almanac Decision Log

Date: 2026-06-13

## 1. Canonical Wiki Content Moves To `docs/almanac/`

Readable wiki pages now belong under `docs/almanac/`. `.almanac/` stays as the
runtime directory for generated local state such as `index.db`, jobs, runs, and
review queues.

Why: the wiki is meant to be read by humans and agents. Putting durable prose
under `docs/` makes it visible in the normal documentation surface instead of
hiding it beside runtime state.

## 2. Legacy Pages Stay Indexed During Migration

The indexer reads `docs/almanac/` first and `.almanac/pages/` second. If both
roots contain the same page slug, the docs page wins and the legacy page is
skipped with a warning.

Why: existing repos should not lose query coverage while migrating. The new
layout still needs a clear precedence rule so stale legacy pages cannot override
new docs.

## 3. Nested Pages Use `page_id`

`page_id` in frontmatter can define the stable page slug. This lets sections use
normal docs names like `README.md` without losing stable wiki identities.

Why: folder structure should serve readability. Slugs should remain stable even
when a page moves from `architecture.md` to `architecture/README.md`.

## 4. Topics Remain YAML

`docs/almanac/topics.yaml` is the canonical topic file when present. Legacy
`.almanac/topics.yaml` is used only when the canonical file does not exist.

Why: topics are source-controlled organization data. SQLite remains the derived
query index, not the authoring source.

## 5. Scaffold Seeds Structure, Not A Finished Wiki

`almanac init` creates `docs/almanac/README.md`, `topics.yaml`, `_manual/`, and
`_meta/`. It does not attempt to generate subsystem pages.

Why: the scaffold should teach the shape and give agents a contract. Full
coverage requires repo-specific reading and should come from build/garden/capture
runs, not static boilerplate.

## 6. `README.md` Is The Front Door

The canonical orientation page is `docs/almanac/README.md`. Build should not
create `getting-started.md` or `project-overview.md` as a second front door.

Why: this matches normal documentation repositories and keeps the browse tree
obvious to humans.

## 7. The Manual Lives Inside The Wiki

The durable writing guidance lives under `docs/almanac/_manual/`, with local
maintenance conventions under `docs/almanac/_meta/`.

Why: agents and humans should read the same guidance in the same documentation
surface. Prompt changes define agent behavior; the manual makes the behavior
auditable and editable.

## 8. Section READMEs Are Orientation, Not Migration

The initial `concepts/`, `architecture/`, `guides/`, `reference/`,
`decisions/`, `incidents/`, `active/`, and `context/` pages explain what belongs
in each section. They do not claim the legacy `.almanac/pages/` corpus has been
semantically migrated.

Why: the structure should be visible now, while full migration remains a
separate content-quality task.

## 9. Repo Detection Uses Tracked Docs Or Runtime State

A repo is an Almanac wiki when it has either `.almanac/` runtime state or a
tracked canonical marker such as `docs/almanac/README.md` or
`docs/almanac/topics.yaml`.

Why: after a clean clone, empty `.almanac/` runtime directories may not exist,
but the tracked documentation wiki still must be discoverable from subfolders.

## 10. Legacy Topic Metadata Must Not Be Shadowed

Topic mutation commands write `docs/almanac/topics.yaml` only when that
canonical file exists or the repo is already a canonical docs wiki without a
legacy topics file. Legacy-only repos keep writing `.almanac/topics.yaml`.

When `init` creates `docs/almanac/topics.yaml` in a repo that already has
legacy `.almanac/topics.yaml`, it copies the legacy topic file instead of
writing the starter topic scaffold.

Why: a single `tag` or `topics create` command must not create a partial
canonical topic file that shadows a richer legacy topic DAG. The same rule
applies to `init` because `build` calls `init` before deciding whether the wiki
already has pages.

## 11. Health Uses `page_id` For Collision Checks

`almanac health` checks slug collisions across all wiki content roots and uses
`page_id` before filenames.

Why: nested docs pages often use `README.md`; collision detection must match the
same page identity model as the indexer.

## 12. Viewer Front Door Means README

The viewer now treats the canonical front door as the README-backed page and
falls back to legacy `getting-started` only for old wikis.

Why: Build no longer creates `getting-started.md`, but old viewer URLs should
still avoid a hard break during migration.
