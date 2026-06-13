# Build Operation

You are building the first substantial Almanac wiki for this repository.

The base prompt modules define the wiki purpose, page-selection rules, folder
structure, and writing syntax. Follow them.

Your job is to create a reusable codebase knowledge base, not a stub wiki and
not a file-tree summary.

## Required Front Door

Always create or update `docs/almanac/README.md` as the wiki front door. This
page is the table of contents and reading map for a new maintainer.

Write it after the initial graph is mostly known so it can route through the
actual pages you created. It should explain what to read first, which clusters
matter, and where common work starts. Link directly to important pages and hubs
with `[[...]]`.

Do not create a second front door such as `getting-started.md` or
`project-overview.md`.

## Tooling Boundary

Build/init creates a local Almanac wiki from the current filesystem. Do not use
MCP tools, OpenAlmanac tools, remote wiki search, or external page search tools
for this operation.

Use filesystem reads, shell/search commands, and direct writes under
`docs/almanac/`. Local runtime state under `.almanac/` is not wiki prose.

Existing `.almanac/pages/` pages may be present during migration. Read them as
source material and preserve useful knowledge, but write new canonical pages in
`docs/almanac/`.

## Algorithm

1. Orient to the corpus: repo layout, commands, package/config files, docs,
   entrypoints, generated outputs, tests, schemas, data files, prompts, and
   external dependencies.
2. Build a working map of the repo from several angles: concepts, subsystems,
   flows, guides, reference contracts, decisions, incidents, active work, and
   context.
3. Investigate important areas deeply enough to explain how they work and how
   they connect. Tests are often the clearest source of intended behavior.
4. Search/read any existing wiki pages before creating replacements. Merge or
   carry forward useful old knowledge instead of duplicating it.
5. Identify page candidates by future reader value. Ask whether each page gives
   a durable subject its proper home.
6. Design the initial browse tree under `docs/almanac/`, then add topics and
   wikilinks as secondary relationship layers.
7. Write grounded article pages with leads, citations, source frontmatter, and
   link context.
8. Re-read the wiki as a new maintainer. Fix weak leads, duplicate pages,
   unsupported claims, missing links, topic noise, and thin placeholders.

Create many pages when many pages are justified. Do not stay tiny to be safe.
Quality is whether each page earns its place and the resulting wiki is readable.

## Helper Agents

If the provider supports helper/subagents and the repo is broad enough, use
them for bounded investigation or draft fragments. Good helper tasks include
investigating one subsystem, tracing one flow, reading tests for one area,
checking an external dependency, or identifying page candidates for one cluster.

The main agent owns final synthesis, page boundaries, folders, topics, links,
hubs, and prose. Helper output is evidence, not completion.

Do not end with page candidates, pages to add later, or an investigation report.
After helpers return, synthesize their findings into actual markdown pages now.

## Output Standard

The output is a coherent `docs/almanac/` wiki. It should let a human maintainer
or restarted agent form a working model of the project faster than by starting
from raw files.
