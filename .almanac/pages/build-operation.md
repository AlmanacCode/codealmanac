---
title: Build Operation
summary: "Build is the `almanac init` operation for first-pass project memory, not a generic compiler from arbitrary files to a wiki."
topics: [agents, flows, cli]
files:
  - src/operations/build.ts
  - src/commands/init.ts
  - src/commands/operations.ts
  - prompts/operations/build.md
sources:
  - /Users/kushagrachitkara/.codex/sessions/2026/05/10/rollout-2026-05-10T14-49-00-019e13dd-740e-7421-9d32-51615ab7c84f.jsonl
status: active
verified: 2026-05-11
---

# Build Operation

Build is the V1 operation behind `almanac init`. It replaced the old public `almanac bootstrap` command and the deleted `prompts/bootstrap.md` flow. The operation creates or opens `.almanac/`, refuses to run against a populated wiki unless `--force` is set, constructs one `AgentRunSpec`, and hands execution to [[process-manager-runs]].

## Command contract

`almanac init` is foreground by default because first-time wiki creation is an onboarding action. `--background` starts an Almanac job and returns the run id. `--json` is only valid for background start responses.

Provider selection comes from `--using <provider[/model]>` when present. Otherwise lifecycle commands read the configured default provider/model through `readConfig({ cwd })`; they do not hardcode Claude as the command default.

## Run spec shape

`src/operations/build.ts` loads `prompts/operations/build.md`, appends runtime context containing the repository root and `.almanac/` paths, and requests the base file-editing tools: read, write, edit, search, and shell. The spec metadata is `{ operation: "build", targetKind: "repo" }`.

The build prompt explicitly tells agents not to use MCP tools, OpenAlmanac tools, remote wiki search, or external page-search tools during init/build. Build is meant to create the local Almanac wiki from the current filesystem, so agents should use filesystem reads, shell/search commands, and direct writes under `.almanac/pages/`. Empty or unavailable local wiki search is not a blocker for first construction.

The helper-agent guidance also separates scout work from build completion. Helpers may be given read-only investigation tasks, but their output is only evidence. The main build agent must not adopt helper read-only constraints for `.almanac/`; after helpers return, it still owns synthesis and must write actual markdown pages instead of ending with page candidates or a "pages to add later" report.

Build does not call a bootstrap-specific SDK wrapper. It uses the same [[harness-providers]] boundary as Absorb and Garden.

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
