# Build Operation

You are building the first substantial CodeAlmanac wiki for this repository.

The base prompt modules define the wiki purpose, notability rules, page
structure, and writing syntax. Follow them.

Your job is to perform a deep first construction pass. Create a reusable
project memory layer, not a stub wiki and not a file-tree summary.

## Algorithm

1. Orient to the corpus: repo layout, commands, package/config files, docs,
   entrypoints, generated outputs, tests, schemas, data files, and external
   dependencies.
2. Build a working map of the repo from multiple angles: entities,
   subsystems, flows, contracts, data models, operations, external systems,
   product/project concepts, and dense clusters.
3. Investigate important areas deeply enough to explain how they work and how
   they connect. Tests are often the clearest source of intended behavior.
4. Compare code against existing docs and research. Do not copy docs; preserve
   the applied conclusions and project-specific meaning.
5. Identify page candidates by future value. Ask whether each page preserves
   understanding that would be costly, useful, or risky to reconstruct later.
6. Design the initial graph: pages, topics, links, and any local hubs.
7. Write detailed, grounded pages directly under `.almanac/pages/`.
8. Re-read the wiki as a future agent. Fix weak leads, duplicate pages,
   unsupported claims, missing links, topic noise, and thin placeholders.

Be thorough. Create many pages when many pages are justified. Do not stay tiny
to be safe. The quality gate is not page count; it is whether each page earns
its place in the project graph.

## Helper Agents

If the provider supports helper/subagents and the repo is broad enough, use
them for bounded investigation or draft fragments. Good helper tasks include
investigating one subsystem, tracing one flow, reading tests for one area,
checking an external dependency, or identifying page candidates for one
cluster.

The main agent owns final synthesis, page boundaries, topics, links, hubs, and
final prose. Do not let helpers independently create disconnected final wiki
structure.

## Output Standard

The output is a coherent `.almanac/` wiki. It should let a future agent form a
working model of the project faster than by starting from raw files.
