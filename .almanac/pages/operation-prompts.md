---
title: Operation Prompts
topics: [agents, decisions]
files:
  - src/agent/prompts.ts
  - src/operations/run.ts
  - prompts/base/purpose.md
  - prompts/base/notability.md
  - prompts/base/syntax.md
  - prompts/operations/build.md
  - prompts/operations/absorb.md
  - prompts/operations/garden.md
  - prompts/agents/.gitkeep
---

# Operation Prompts

V1 prompt layout is base doctrine plus operation algorithms. The bundled base prompts are `prompts/base/purpose.md`, `prompts/base/notability.md`, and `prompts/base/syntax.md`. The operation prompts are `prompts/operations/build.md`, `prompts/operations/absorb.md`, and `prompts/operations/garden.md`. `prompts/agents/` exists only as an empty future home. The deleted old prompt files are `prompts/bootstrap.md`, `prompts/writer.md`, and `prompts/reviewer.md`.

## Loading

`src/agent/prompts.ts` still owns prompt lookup, but it now recognizes nested base and operation names such as `base/purpose` and `operations/build`. `resolvePromptsDir()` probes installed and source layouts and requires all base and operation prompts to exist before accepting a directory. `resolvePromptPath()` rejects absolute paths, backslashes, empty path parts, `.`, and `..` so prompt names cannot escape `prompts/`.

## Assembly

`src/operations/run.ts` loads base prompts in a fixed order before the operation prompt:

1. `base/purpose`
2. `base/notability`
3. `base/syntax`
4. the selected operation prompt
5. runtime context
6. command-specific context

`joinPrompts()` concatenates these modules with `---` separators. There is no manifest, proposal file, evidence pipeline, or prompt-state object between the CLI and the provider adapter.

## Base modules

`purpose.md` defines CodeAlmanac as cultivated project memory and a deep-research cache over the project. It says the codebase is the anchor, not the boundary, and that inputs are raw material rather than outputs.

`notability.md` defines what deserves a page, topic, cluster, or hub. It treats page genres as vocabulary, not schema, and explicitly includes internal entities, external dependencies, influences, research synthesis, market/product synthesis, and hubs.

`syntax.md` defines frontmatter, source grounding, natural slugs, wikilink syntax, page shape, and writing conventions. It keeps current indexed fields (`title`, `topics`, `files`, archive/supersession fields) while allowing prompt-level fields such as `sources`, `status`, `verified`, and `external_version`.

## Operation algorithms

Build is a deep first construction pass. It should explore the corpus from multiple angles, synthesize entities/subsystems/flows/contracts/data models/project-world clusters, and build a substantial first wiki when the pages are justified.

Absorb starts from an input and distills reusable project understanding into the existing graph. It prefers evolving synthesis pages over date-stamped fragments, and creates temporal pages only when time or event context is part of the meaning.

Garden cultivates the graph. It improves clusters, hubs, topics, links, page boundaries, staleness, archive/supersession chains, and synthesis quality.

## Design implication

If Build, Absorb, or Garden need better judgment, edit the relevant base or operation prompt. Do not recreate the removed writer/reviewer/review-apply pipeline in TypeScript. Helper/subagents remain optional provider behavior described inside operation prompts, not fixed CodeAlmanac product roles.
