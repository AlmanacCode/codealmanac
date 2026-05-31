# Ingest Boundary Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move source-specific ingest input resolution and prompt-context rendering out of the lifecycle command wrapper.

**Architecture:** Keep `runIngestCommand()` as the CLI-facing command adapter and keep Absorb as the wiki-writing engine. Add an ingest boundary that turns command inputs into operation-facing ingest input and renders source-specific context from resolved source facts.

**Tech Stack:** TypeScript ESM, existing Absorb operation flow, Vitest, TypeScript compiler.

---

## Context

`src/commands/operations.ts` mixed command orchestration with ingest input classification, source-ref parsing, GitHub source resolution, path resolution, and GitHub PR prompt guidance. That made the command wrapper the first place future source kinds would grow.

The target shape keeps deterministic source handling under `src/ingest/`:

```text
CLI command -> resolveIngestInput -> renderIngestContext -> runAbsorbOperation
```

## Task 1: Extract Ingest Input Resolution

**Files:**
- Create: `src/ingest/input.ts`
- Modify: `src/commands/operations.ts`
- Test: `test/ingest-input.test.ts`

Move the `ResolvedIngestInput` type, local-path resolution, source-ref classification, mixed source/path rejection, and default GitHub resolver dispatch from `src/commands/operations.ts` to `src/ingest/input.ts`.

`runIngestCommand()` should call:

```ts
const input = await resolveIngestInput({
  cwd: options.cwd,
  inputs: options.paths,
  resolveSource: options.resolveSource,
});
```

## Task 2: Extract Ingest Context Rendering

**Files:**
- Create: `src/ingest/context.ts`
- Modify: `src/commands/operations.ts`
- Test: `test/ingest-input.test.ts`

Move path-context rendering and GitHub PR source guidance from `src/commands/operations.ts` to `src/ingest/context.ts`.

`runIngestCommand()` should pass:

```ts
context: renderIngestContext(input.value)
```

## Task 3: Verify Behavior

Run:

```bash
npm test -- --run test/ingest-input.test.ts test/source-ref.test.ts test/github-source-resolver.test.ts test/operation-commands.test.ts
npm run lint
```

If `npm` is unavailable in the execution environment, run local binaries with the available Node executable:

```bash
node ./node_modules/.bin/vitest run test/ingest-input.test.ts test/source-ref.test.ts test/github-source-resolver.test.ts test/operation-commands.test.ts
node ./node_modules/.bin/tsc --noEmit
```

Expected: all tests and type checks pass. If native optional dependency code-signature issues block Vitest, record that explicitly and keep the TypeScript check green.

## Implementation Notes

- 2026-05-31: Added `src/ingest/input.ts` and `src/ingest/context.ts`.
- 2026-05-31: `src/commands/operations.ts` now calls the ingest boundary instead of importing source-ref parsing or GitHub source resolution.
- 2026-05-31: Added `test/ingest-input.test.ts` for path resolution, source resolution, mixed-input rejection, and GitHub PR context rendering.
