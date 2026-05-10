---
title: Operation Prompts
topics: [agents, decisions]
files:
  - src/agent/prompts.ts
  - prompts/operations/build.md
  - prompts/operations/absorb.md
  - prompts/operations/garden.md
  - prompts/agents/.gitkeep
---

# Operation Prompts

V1 prompt layout is operation-first. The bundled prompts are `prompts/operations/build.md`, `prompts/operations/absorb.md`, and `prompts/operations/garden.md`; `prompts/agents/` exists only as an empty future home. The deleted old prompt files are `prompts/bootstrap.md`, `prompts/writer.md`, and `prompts/reviewer.md`.

## Loading

`src/agent/prompts.ts` still owns prompt lookup, but it now recognizes nested operation names such as `operations/build`. `resolvePromptsDir()` probes installed and source layouts and requires all operation prompts to exist before accepting a directory. `resolvePromptPath()` rejects absolute paths, backslashes, empty path parts, `.`, and `..` so prompt names cannot escape `prompts/`.

## Assembly

Operations use `joinPrompts()` to concatenate the operation prompt, runtime context, and command-specific context with `---` separators. There is no manifest, proposal file, evidence pipeline, or prompt-state object between the CLI and the provider adapter.

## Design implication

If Build, Absorb, or Garden need better judgment, edit the relevant operation prompt. Do not recreate the removed writer/reviewer/review-apply pipeline in TypeScript.
