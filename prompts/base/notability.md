# Page Selection And Organization

Use these rules to decide what deserves a page, where it belongs, and when a
cluster needs subfolders or a hub. They are editorial guidance, not a rigid
schema.

## What Becomes A Page

A page deserves to exist when it gives a durable subject its own home: a place
where future facts about that subject should accumulate.

Good page subjects include:

- **Concept**: project vocabulary a new maintainer needs before reading code.
- **Subsystem**: an area with responsibility, boundaries, state, and callers.
- **Flow**: behavior that crosses commands, files, processes, agents, or
  external systems.
- **Guide**: a task a maintainer repeatedly performs.
- **Reference contract**: an exact command, file format, config surface, API,
  environment variable, schema, or public behavior.
- **Decision**: an accepted choice with context, alternatives, and consequences.
- **Incident**: a failure, regression, migration, or debugging lesson that still
  changes how future work should be done.
- **External dependency or competitor**: only as it matters to this project.
- **Product or strategy context**: durable background that shapes design,
  positioning, trust, or roadmap decisions.
- **Hub**: a curated reading path for a dense cluster.

If a candidate page has no stable subject, merge it into an existing page or
leave it out.

## What Usually Does Not Become A Page

Avoid pages that are only:

- file-by-file summaries
- folder trees in prose
- raw transcripts or task logs
- brainstorming that has not become a decision, incident, or durable context
- generic external API docs copied from the web
- one-off facts obvious from one nearby file
- speculative explanations of why code exists
- pages whose only claim is that something exists
- date-stamped notes with no later synthesis value

If an input changes an existing subject, update that existing page.

## Folder Roles

Place pages by primary reading home. Wikilinks and topics carry cross-cutting
relationships.

- `README.md`: the front door and table of contents for the wiki.
- `concepts/`: vocabulary and mental models needed before code makes sense.
- `architecture/`: subsystem articles, runtime flows, storage, boundaries, and
  integration shape.
- `guides/`: task-oriented pages such as setup, debugging, release, migration,
  and common maintenance workflows.
- `reference/`: exact public contracts. Keep it concrete: commands, flags,
  config keys, file formats, schemas, environment variables, and stable APIs.
  Do not duplicate implementation internals that the code already owns.
- `decisions/`: accepted choices and rationale. A decision page should say what
  was chosen, what alternatives were plausible, and what would reopen it.
- `incidents/`: failures, regressions, migrations, and gotchas with current
  operational lessons.
- `active/`: current investigations or design threads. Keep it small. Fold
  settled knowledge into durable sections.
- `context/`: product, market, competitor, user, fundraising, or strategy
  background that shapes this repo.
- `_manual/`: how to write and maintain this wiki.
- `_meta/`: wiki-maintenance notes such as conventions, coverage, redirects,
  source gaps, and migration status.

Subfolders are encouraged when they make a section easier to scan. For example,
`context/competitors/deepwiki.md` is clearer than a flat pile of competitor
pages once competitor coverage grows.

## Hubs And Reading Paths

Create a hub when a reader can no longer understand a cluster from search
results alone. A hub should explain what the cluster is, what to read first,
which pages are core, and how the pages relate.

Do not create empty taxonomies. Structure should make actual pages easier to
read, not predict every future category.

## Topics

Topics are secondary retrieval neighborhoods, stored in
`docs/almanac/topics.yaml`. They do not replace folders and they do not own page
identity.

Use topics when they help answer "what should be read together?" Prefer stable
clusters such as `provider-harness`, `wiki-indexing`, `product-positioning`, or
`prompt-system` over bookkeeping labels such as `misc`, `notes`, or dates.
