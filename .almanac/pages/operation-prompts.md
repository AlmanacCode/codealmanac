---
title: Operation Prompts
summary: Operation prompts define how Build, Absorb, and Garden turn repo evidence into wiki memory, and transcript-heavy Absorb runs should be improved in prompt space first.
topics: [agents, decisions]
sources:
  - id: prompt-loader
    type: file
    path: src/agent/prompts.ts
    note: Resolves bundled base and operation prompt files.
  - id: operation-runner
    type: file
    path: src/operations/run.ts
    note: Assembles base prompts, operation prompts, runtime context, and source-control context.
  - id: purpose-prompt
    type: file
    path: prompts/base/purpose.md
    note: Defines the shared Almanac purpose prompt module.
  - id: notability-prompt
    type: file
    path: prompts/base/notability.md
    note: Defines page, topic, hub, and graph notability doctrine.
  - id: syntax-prompt
    type: file
    path: prompts/base/syntax.md
    note: Defines page syntax, source grounding, and source-control hygiene.
  - id: build-prompt
    type: file
    path: prompts/operations/build.md
    note: Defines the Build operation algorithm.
  - id: absorb-prompt
    type: file
    path: prompts/operations/absorb.md
    note: Defines the Absorb operation algorithm.
  - id: garden-prompt
    type: file
    path: prompts/operations/garden.md
    note: Defines the Garden operation algorithm.
  - id: agents-placeholder
    type: file
    path: prompts/agents/.gitkeep
    note: Marks the empty future home for helper-agent prompts.
  - id: transcript-capture-review
    type: conversation
    path: /Users/kushagrachitkara/.codex/sessions/2026/05/11/rollout-2026-05-11T14-32-08-019e18f4-5e73-7790-ba49-73cc02544a58.jsonl
    note: Records the transcript-capture prompt gap about noisy JSONL inputs.
  - id: organization-discussion
    type: conversation
    path: /Users/rohan/.codex/sessions/2026/05/27/rollout-2026-05-27T16-27-22-019e6b55-bee7-79d3-ba21-2852c5372082.jsonl
    note: Records the design discussion behind graph organization prompt doctrine.
  - id: source-provenance-session
    type: conversation
    path: /Users/rohan/.codex/sessions/2026/05/28/rollout-2026-05-28T12-14-55-019e6f94-fae1-7780-b2c9-3e2f3d6b6f3e.jsonl
    note: Records the source provenance, getting-started convention, and auto-commit prompt changes.
status: active
verified: 2026-05-28
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
6. source-control runtime context
7. command-specific context

`joinPrompts()` concatenates these modules with `---` separators. There is no manifest, proposal file, evidence pipeline, or prompt-state object between the CLI and the provider adapter. The source-control runtime context resolves `auto_commit` from user config and explicitly tells the agent whether it may create a wiki-only git commit. Auto-commit is now on by default through `defaultConfig().auto_commit`; `almanac setup --no-auto-commit` or `almanac config set auto_commit false` are the opt-out paths. The commit-message contract is `almanac: <imperative one-line summary>` followed by an optional body explaining what changed and why.

## Base modules

`purpose.md` defines Almanac as cultivated project memory and a deep-research cache over the project. It says the codebase is the anchor, not the boundary, and that inputs are raw material rather than outputs.

`notability.md` defines what deserves a page, topic, cluster, or hub. It treats page genres as vocabulary, not schema, and explicitly includes internal entities, external dependencies, influences, research synthesis, market/product synthesis, and hubs.

`syntax.md` defines frontmatter, source grounding, natural slugs, wikilink syntax, page shape, writing conventions, and source-control hygiene. It now treats structured `sources:` as the canonical provenance field, with `files:` documented as legacy compatibility for older pages. The indexed frontmatter fields include `title`, `topics`, `sources`, and archive/supersession fields; [[source-provenance]] explains how `sources[type=file]` and legacy `files:` still populate file-aware query behavior. Its source-control rule treats `.almanac/README.md`, `.almanac/pages/`, and `.almanac/topics.yaml` as wiki source files, but commits them only when the runtime context says auto-commit is enabled. When commits are enabled, the subject must be concise, imperative, and specific, and the optional body is reserved for non-obvious decisions, migrations, source corrections, or graph cleanups that future agents should understand from Git history. The anti-cramming / anti-thinning failure modes documented in [[farzapedia]] and the prohibited-phrase list there are sharper enforcement vocabulary than what `syntax.md` currently names; they are a candidate for a future `syntax.md` revision.

The next base-module candidate is `prompts/base/organization.md`. A 2026-05-27 discussion grounded in [[wiki-organization-primitives]], [[documenting-software-architectures]], Diataxis, and Write the Docs concluded that the prompt stack needs graph-shape doctrine in addition to page-worthiness and page syntax. That module should answer where knowledge belongs in the graph: anchor, hub, workflow page, reference page, decision page, archive, or no-op. It should use strong slugs, leads, links, topics, and hub prose for editorial meaning instead of adding `subject:` or `type:` frontmatter. It should not introduce proposal files, deterministic pre-query pipelines, or a separate TypeScript state machine.

The same module should require composition planning before article prose. A 2026-05-27 Codex critique found that an agent can produce factually useful prose while still blurring page boundaries if it starts drafting before deciding the article set. The intended rule is: identify durable entities and concepts, choose the smallest page set that covers them without cramming, state each page's scope and exclusions, assign adjacent facts to their owning pages, and only then write article prose. This belongs in prompt doctrine, not in a TypeScript planning artifact or a persisted proposal file.

The composition-planning rule should also make page shape more flexible than prose paragraphs alone. Quick facts, summary tables, timelines, bullet lists, and infobox-style sections are allowed when they make dense entity pages easier to scan. They should supplement sourced article prose rather than replace it.

One current prompt artifact conflicts with that decision: `prompts/base/notability.md` still ends with a stray `## **type: runtime-view**` heading. That heading is prompt debt from the rejected frontmatter-schema direction, not an accepted page convention. Future prompt work should remove it or fold the intended architecture-view vocabulary into the prose-only organization module.

## Operation algorithms

Build is a deep first construction pass. It should explore the corpus from multiple angles, synthesize entities/subsystems/flows/contracts/data models/project-world clusters, and build a substantial first wiki when the pages are justified.

Build has one required navigation-page convention: `.almanac/pages/getting-started.md`. The prompt names it as the canonical wiki front door and explicitly rejects creating `project-overview.md` as a second front-door page. `project-overview.md` remains available as an ordinary subject page when the concept itself earns a page.

Absorb starts from an input and distills reusable project understanding into the existing graph. It prefers evolving synthesis pages over date-stamped fragments, and creates temporal pages only when time or event context is part of the meaning.

For session-transcript inputs, a later 2026-05-11 capture review identified one prompt gap worth preserving: `prompts/operations/absorb.md` currently says to treat the input as raw material, but it does not yet explicitly tell the agent to parse transcript JSONL structurally and ignore repeated raw envelopes, long tool schemas, and oversized stdout unless they matter to a durable conclusion. That is current prompt debt, not a missing concept in the product model.

Garden cultivates the graph. It improves clusters, hubs, topics, links, page boundaries, staleness, archive/supersession chains, and synthesis quality. The editorial model behind those outcomes is captured in [[wiki-organization-primitives]].

## Design implication

If Build, Absorb, or Garden need better judgment, edit the relevant base or operation prompt. Do not recreate the removed writer/reviewer/review-apply pipeline in TypeScript. Helper/subagents remain optional provider behavior described inside operation prompts, not fixed CodeAlmanac product roles. This prompt layer is separate from prescriptive agent rules such as [[agents-md]] or `CLAUDE.md`: operation prompts carry run-specific Almanac behavior, while instruction files carry durable session conventions for a given agent harness.

The transcript-capture review also produced a concrete example of that rule: if large session JSONL files become too expensive or noisy for Absorb, the first corrective move should be to strengthen `prompts/operations/absorb.md` with transcript-specific extraction guidance, and only then consider extra preflight tooling such as size warnings or caps.
