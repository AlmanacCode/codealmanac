# Wiki Purpose

CodeAlmanac is cultivated project memory.

The wiki is a deep-research cache over the project. It preserves the
understanding that an expert agent builds after reading, tracing, comparing,
and connecting raw inputs. Future agents should start from this reusable
understanding instead of repeatedly reorienting from zero.

The codebase is the anchor, not the boundary. The wiki may absorb code,
sessions, docs, research, market reads, product thinking, incidents,
conversations, external systems, laws, papers, team practices, and anything
else that materially shapes work on the project.

The page is not the raw input. The input is material to be distilled into the
project's memory.

## The Core Test

A wiki change is valuable when it preserves durable, reusable project
understanding that would be costly, useful, or risky to reconstruct later.

That includes:

- how the codebase works
- what named entities mean in this project
- how subsystems, files, commands, and external systems interact
- what conclusions were drawn from reading docs or doing research
- what the project currently believes about product, users, market, or design
- what decisions, constraints, risks, and incidents should shape future work
- what is intentionally not used or not done

Do not reduce the wiki to a bug-prevention notebook. Avoiding future mistakes
matters, but the larger goal is reusable understanding.

## Project-World Map

Pages may cover things outside the repo when they matter to the project.
`stripe.md`, `postgres.md`, `claude-agent-sdk.md`,
`anthropic-prompt-caching.md`, or `agent-tools-market.md` can all be valid
pages.

Do not copy the world. Preserve the useful understanding produced by engaging
with the world.

For an external thing, write about its role in this project:

- what we use
- what we do not use
- what assumptions we rely on
- what versions, APIs, contracts, or docs matter
- what conclusions we reached
- what pages, decisions, code, or project beliefs it connects to

Pure reference material is allowed when it is reusable project memory. It still
needs to be distilled, grounded, and connected to the project graph.

## Synthesis Over Logs

Prefer evolving synthesis pages over chronological logs.

If an input says something about market sentiment, pricing, product
positioning, user trust, an external dependency, or an internal subsystem,
fold it into the durable page that tracks that idea.

Create a temporal page only when the time, event, or snapshot is itself part of
the meaning. A dated market read, incident, migration, API breaking change, or
launch-period observation may deserve a temporal page. If you create one, also
connect it to the synthesis page or hub it informs.

The wiki is not a diary, transcript store, or progress log. It is cultivated
project memory.

## Inputs Are Starting Points

Build starts from the repo corpus.

Absorb starts from a concrete input: a session, file, folder, diff, document,
research note, market read, conversation, or other context.

Garden starts from the current wiki graph.

In every case, the starting point is not a boundary. Inspect related code,
wiki pages, docs, tests, history, or sources when useful. Keep the scope
proportional to what the input reveals.
