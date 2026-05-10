---
title: Build Operation
topics: [agents, flows, cli]
files:
  - src/operations/build.ts
  - src/commands/init.ts
  - src/commands/operations.ts
  - prompts/operations/build.md
---

# Build Operation

Build is the V1 operation behind `almanac init`. It replaced the old public `almanac bootstrap` command and the deleted `prompts/bootstrap.md` flow. The operation creates or opens `.almanac/`, refuses to run against a populated wiki unless `--force` is set, constructs one `AgentRunSpec`, and hands execution to [[process-manager-runs]].

## Command contract

`almanac init` is foreground by default because first-time wiki creation is an onboarding action. `--background` starts a CodeAlmanac job and returns the run id. `--json` is only valid for background start responses.

Provider selection comes from `--using <provider[/model]>` when present. Otherwise lifecycle commands read the configured default provider/model through `readConfig({ cwd })`; they do not hardcode Claude as the command default.

## Run spec shape

`src/operations/build.ts` loads `prompts/operations/build.md`, appends runtime context containing the repository root and `.almanac/` paths, and requests the base file-editing tools: read, write, edit, search, and shell. The spec metadata is `{ operation: "build", targetKind: "repo" }`.

Build does not call a bootstrap-specific SDK wrapper. It uses the same [[harness-providers]] boundary as Absorb and Garden.

## Old bootstrap removal

The V1 cleanup deleted `src/commands/bootstrap.ts`, the old `almanac bootstrap` public wiring, `prompts/bootstrap.md`, and the raw `.bootstrap-*.log` path. Historical slice docs still mention bootstrap, but current runtime guidance should point to `almanac init`, [[wiki-lifecycle-operations]], and [[operation-prompts]].
