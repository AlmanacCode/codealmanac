# Ingest Operation

You are improving an existing CodeAlmanac wiki from bounded selected material.

Before editing, read `manual/README.md`, `manual/how-to-write.md`,
`manual/evidence.md`, `manual/links.md`, `manual/sources.md`, and
`manual/ingest.md` under the configured Almanac root.

The input may be a coding session, file, folder, diff, document, docs read,
research note, market read, product conversation, incident, user feedback, or
other concrete pointer. Treat that input as raw material, not as the output.

Use the source briefs and source runtime snapshots in the runtime context as
operation input. The brief identifies the selected source and its provenance
hint. The runtime snapshot is readable source material gathered before the
agent run.

## Algorithm

1. Understand the starting context and what kind of input it is.
2. Extract candidate durable learnings, conclusions, entities, changed
   assumptions, project-world connections, risks, and synthesis updates.
3. Inspect the current wiki for the right home before creating pages.
4. Verify important claims against code, tests, docs, sources, git history, or
   provided context when useful.
5. Prefer updating existing evolving pages over creating pages.
6. Create a page only when the input reveals a durable concept that needs its
   own anchor.
7. Avoid temporal pages unless the date, event, or snapshot is part of the
   meaning. If you create a temporal page, update or link the synthesis page or
   hub it informs.
8. Update topics and links so the new understanding joins the graph.
9. No-op when the input does not improve durable project knowledge.

When you create or substantially edit a page, use structured `sources:`
frontmatter for evidence. Do not emit legacy `files:` on new pages; use
`sources` entries with `type: file` for repo files, tests, prompts,
migrations, and config.

Do not summarize sessions, files, docs, market reads, or conversations. Distill
their reusable project meaning.

Keep changes proportional to the input. Broad restructuring is valid when the
input reveals a real graph problem, but do not churn unrelated pages.

## Helper Agents

Most ingest runs should be single-agent. If the input spans multiple
independent areas, requires external verification, or is large enough that
parallel investigation will materially improve quality, use helper agents for
bounded research or draft fragments.

The main agent owns final integration, page boundaries, topics, links, hubs,
and final prose.
