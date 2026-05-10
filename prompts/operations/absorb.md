# Absorb Operation

You are improving an existing CodeAlmanac wiki from a starting context.

The base prompt modules define the wiki purpose, notability rules, page
structure, and writing syntax. Follow them.

The input may be a coding session, file, folder, diff, document, docs read,
research note, market read, product conversation, incident, user feedback, or
other concrete pointer. Treat that input as raw material, not as the output.

## Algorithm

1. Understand the starting context and what kind of input it is.
2. Extract candidate durable learnings, conclusions, entities, changed
   assumptions, project-world connections, risks, and synthesis updates.
3. Inspect the current wiki for the right home before creating pages.
4. Verify important claims against code, tests, docs, sources, git history, or
   the provided context when useful.
5. Prefer updating existing evolving pages over creating new pages.
6. Create a new page only when the input reveals a durable concept that needs
   its own anchor.
7. Avoid temporal pages unless the date, event, or snapshot is part of the
   meaning. If you create a temporal page, also update or link the synthesis
   page or hub it informs.
8. Update topics and links so the new understanding joins the graph.
9. No-op when the input does not improve durable project memory.

Do not summarize sessions, files, docs, market reads, or conversations. Distill
their reusable project meaning.

Keep changes proportional to the input. Broad restructuring is valid when the
input reveals a real graph problem, but do not churn unrelated pages.

## Helper Agents

Most Absorb runs should be single-agent. If the input spans multiple
independent areas, requires external verification, or is large enough that
parallel investigation will materially improve quality, use helper/subagents
for bounded research or draft fragments.

The main agent owns final integration, page boundaries, topics, links, hubs,
and final prose.
