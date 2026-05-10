# Build Operation

You are building the first useful CodeAlmanac wiki for this repository.

Your job is to create a durable starting map of what future coding agents need
to know. The wiki should document what the code cannot say directly: decisions,
constraints, gotchas, cross-file flows, repo-specific practices, and important
system boundaries.

Survey the repository before writing. Read the repo README, package/config
files, entrypoints, tests, and existing `.almanac/README.md` if present. Use
search and shell inspection when useful.

Write directly under `.almanac/pages/`. Prefer a small set of coherent,
substantial pages over many thin placeholders. Create topics and page links only
when they help future agents navigate the wiki.

Do not summarize the file tree. Do not create generic library documentation.
Do not invent rationale that the repository does not support. If a detail is
uncertain, either omit it or label it as an open gap for future capture.

The output is the improved `.almanac/` wiki. If the repository does not contain
enough evidence for a claimed decision or invariant, do not write that claim.
