---
title: Build Operation
summary: "Build is the `almanac init` operation for first-pass project memory, not a generic compiler from arbitrary files to a wiki."
topics: [agents, flows, cli]
files:
  - src/operations/build.ts
  - src/commands/init.ts
  - src/commands/operations.ts
  - prompts/operations/build.md
  - src/viewer/api.ts
  - viewer/app.js
sources:
  - /Users/kushagrachitkara/.codex/sessions/2026/05/10/rollout-2026-05-10T14-49-00-019e13dd-740e-7421-9d32-51615ab7c84f.jsonl
  - /Users/rohan/.codex/sessions/2026/05/28/rollout-2026-05-28T00-28-55-019e6d0e-a0d0-7ec0-bbbd-92d2c677608c.jsonl
  - /Users/rohan/.codex/sessions/2026/05/28/rollout-2026-05-28T12-14-55-019e6f94-fae1-7780-b2c9-3e2f3d6b6f3e.jsonl
status: active
verified: 2026-05-28
---

# Build Operation

Build is the V1 operation behind `almanac init`. It replaced the old public `almanac bootstrap` command and the deleted `prompts/bootstrap.md` flow. The operation creates or opens `.almanac/`, refuses to run against a populated wiki unless `--force` is set, constructs one `AgentRunSpec`, and hands execution to [[process-manager-runs]].

## Command contract

`almanac init` is foreground by default because first-time wiki creation is an onboarding action. The foreground default is still quiet: it prints `Analyzing codebase... This usually takes 5-10 minutes.` before the build run, waits, then prints `init finished: <run-id>` and `Browse the wiki: almanac serve` without echoing every agent tool call. `--verbose` restores the live text/tool stream for debugging. `--background` starts an Almanac job and returns the run id. `--json` is only valid for background start responses.

Provider selection comes from `--using <provider[/model]>` when present. Otherwise lifecycle commands read the configured default provider/model through `readConfig({ cwd })`; they do not hardcode Claude as the command default.

A 2026-05-28 UX discussion set the timing rule for future progress display. Deterministic scaffold work should report elapsed time rather than an ETA because it should finish quickly enough that a remaining-time estimate looks artificial. AI-backed Build work may show elapsed time plus approximate remaining time, but the remaining estimate should be marked with `~` and treated as a rough guide rather than a promise.

## Run spec shape

`src/operations/build.ts` loads `prompts/operations/build.md`, appends runtime context containing the repository root and `.almanac/` paths, and requests the base file-editing tools: read, write, edit, search, and shell. The spec metadata is `{ operation: "build", targetKind: "repo" }`.

The build prompt explicitly tells agents not to use MCP tools, OpenAlmanac tools, remote wiki search, or external page-search tools during init/build. Build is meant to create the local Almanac wiki from the current filesystem, so agents should use filesystem reads, shell/search commands, and direct writes under `.almanac/pages/`. Empty or unavailable local wiki search is not a blocker for first construction.

The helper-agent guidance also separates scout work from build completion. Helpers may be given read-only investigation tasks, but their output is only evidence. The main build agent must not adopt helper read-only constraints for `.almanac/`; after helpers return, it still owns synthesis and must write actual markdown pages instead of ending with page candidates or a "pages to add later" report.

Build does not call a bootstrap-specific SDK wrapper. It uses the same [[harness-providers]] boundary as Absorb and Garden.

## Required navigation page

Build now has one front-door convention: `.almanac/pages/getting-started.md`. The Build prompt requires this page as the wiki navigation entry point and says it is for routing a future reader through the wiki, not for repository setup or install instructions.

`project-overview.md` is not a paired front-door convention. A page with that slug can still exist if a specific wiki has a normal project-overview subject, but Build should not create it as an optional second homepage and [[almanac-serve|the local viewer]] should not treat it as a fallback for the home route.

## Non-code corpus boundary

A 2026-05-10 session tested `almanac init --using codex -y` inside a folder that contained five menopause-related `.xlsx` files rather than a software repo. The run completed and inspected the workbooks, but the final summary was a no-op: `created: 0`, `updated: 0`, `archived: 0`.

The important learning was semantic, not mechanical. Build could read the corpus well enough to extract sheet structure, article groupings, supplement rows, and term hits. The failure mode was that the prompt and operation semantics still framed the task as "build first-pass project memory for this repo" rather than "compile a standalone knowledge wiki from an arbitrary source bundle."

That boundary matters when interpreting `init` behavior:

- Build/init is reliable for first-pass Almanac project memory over the current filesystem.
- Successful inspection of files does not guarantee page creation when the corpus is not meaningfully a project/codebase and the prompt framing still asks for project memory.
- A generic corpus-to-wiki compiler is conceptually closer to [[farzapedia]] than to Almanac's current Build semantics.

The same session also motivated the stricter tool boundary now captured in [[operation-prompts]] and this page: Build should use local filesystem reads plus direct writes under `.almanac/pages/`, and an empty or unavailable local wiki search must not be treated as a reason to avoid writing the first wiki pages.

## Old bootstrap removal

The V1 cleanup deleted `src/commands/bootstrap.ts`, the old `almanac bootstrap` public wiring, `prompts/bootstrap.md`, and the raw `.bootstrap-*.log` path. Historical slice docs still mention bootstrap, but current runtime guidance should point to `almanac init`, [[wiki-lifecycle-operations]], and [[operation-prompts]].
