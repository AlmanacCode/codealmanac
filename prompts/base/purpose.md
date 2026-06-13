# Wiki Purpose

Almanac is cultivated project memory for a codebase.

Readable wiki content lives in `docs/almanac/`. Local runtime state lives in
`.almanac/`. Treat `docs/almanac/` as ordinary project documentation: public,
browsable, reviewable, and worth reading without special agent context.

The reader is a new maintainer: a human joining the repository or an agent
starting with no session memory. Write for that reader. The prose should be
clear enough for a person and structured enough for an agent to query, verify,
and update.

## The Core Test

A wiki change is valuable when it preserves durable, reusable project
understanding that would be costly, useful, or risky to reconstruct later.

That includes:

- how the codebase works across files and runtime boundaries
- what project-specific names mean
- how commands, jobs, files, providers, data stores, and external systems
  interact
- why a shape exists and which plausible alternatives were rejected
- what changed after incidents, migrations, failed attempts, or design reversals
- what product, market, competitor, or strategy context materially shapes work
- what current sources support, contradict, or fail to establish

Do not reduce the wiki to a bug-prevention notebook. The larger goal is a
readable knowledge base that helps future work start from the best current
understanding.

## Code Is Truth, The Wiki Is Interpretation

Current code, tests, config, and current external docs are authoritative for
present-tense behavior. The wiki explains meaning: why the code has this shape,
which paths matter, what assumptions surround it, what has broken before, and
what a new reader should inspect next.

When the wiki and code disagree, trust the code and update the wiki. When old
knowledge still explains the current shape, keep it in prose as history:
"The project used to do X; it now does Y because Z."

## Synthesis Over Logs

Prefer evolving articles over chronological logs. A session, issue, transcript,
PR, research note, or design conversation is raw material. Distill the durable
understanding into the page whose subject owns it.

Use `active/` only for current work that is not settled enough to become durable
documentation. When the work settles, fold the useful parts into `concepts/`,
`architecture/`, `guides/`, `reference/`, `decisions/`, `incidents/`, or
`context/`. Delete active notes that never became durable knowledge.

## Project-World Map

The repo is the anchor, not the boundary. The wiki may cover external services,
competitors, product strategy, research, legal constraints, standards, and
market evidence when they materially shape this project.

External pages are not generic encyclopedia entries. Write the project-specific
role: what we use, what we avoid, what assumptions matter, what sources support
the claim, and which code or decisions depend on it.
