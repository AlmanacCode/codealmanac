# Remaining Cleanup Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Finish the remaining organization cleanup called out after the v2 refactor assessment.

**Architecture:** Keep behavior unchanged and split by responsibility, not by framework. The current command APIs stay stable; new modules should expose small helpers used by the existing command entrypoints.

**Tech Stack:** TypeScript, Commander, Vitest, better-sqlite3, fast-glob.

---

## Scope

Must-fix:
- Split `src/commands/topics.ts` so read formatting, mutation workspace, and page rewrites are no longer buried in one file.
- Add lightweight regression coverage for the CLI command surface so future registration splits cannot silently drop commands or options.
- Organize `setup` and `hook` responsibilities on top of the current working-tree behavior without reverting existing local edits.

Out of scope:
- Changing CLI behavior, command names, option semantics, output text, or topic DAG rules.
- Introducing a GUI architecture framework into the CLI.
- Rewriting setup/hook behavior beyond extracting named helpers.

## Task 1: Topics Module Split

Files:
- Modify: `src/commands/topics.ts`
- Create: `src/commands/topics/read.ts`
- Create: `src/commands/topics/workspace.ts`
- Create: `src/commands/topics/pageRewrite.ts`

Steps:
1. Move `TopicsShowRecord`, `pagesDirectlyTagged`, `pagesForSubtree`, and `formatShow` into `topics/read.ts`.
2. Move `TopicsWorkspace`, `resolveTopicsRepo`, `openFreshTopicsWorkspace`, `closeWorkspace`, and `topicExists` into `topics/workspace.ts`.
3. Move `rewriteTopicOnPages` into `topics/pageRewrite.ts`.
4. Update imports in `topics.ts` and keep all exported command functions in `topics.ts`.
5. Run `npm test -- test/topics.test.ts test/tag.test.ts` and `npm run lint`.
6. Commit as `refactor(v2): split topics helpers`.

## Task 2: CLI Command Surface Regression Test

Files:
- Modify: `test/cli.test.ts`

Steps:
1. Add a test that instantiates `program` through `run()` with `--help` or imports the registration shape indirectly.
2. Verify the expected command names remain present: query commands, edit commands, wiki lifecycle commands, setup commands, and hook subcommands.
3. Verify representative options for renamed risk areas: `setup --yes`, `doctor --json`, `topics show --descendants`, `search --mentions`, `list --drop`.
4. Keep the test broad but not brittle to help text wording.
5. Run `npm test -- test/cli.test.ts` and `npm run lint`.
6. Commit as `test(v2): cover CLI command surface`.

## Task 3: Setup And Hook Responsibility Split

Files:
- Modify: `src/commands/setup.ts`
- Modify: `src/commands/hook.ts`
- Create supporting files under `src/commands/setup/` and/or `src/commands/hook/` only if the split clearly reduces the main file size.
- Modify tests only if imports need updating or coverage catches a refactor regression.

Steps:
1. Preserve the current working-tree behavior exactly, including stable hook copy, ephemeral install detection, ABI guard integration, and updated next steps.
2. Extract setup install-path detection and global install spawning into a setup helper module.
3. Extract setup next-step rendering/repo page counting into a setup helper module.
4. Extract hook script resolution/stable copy into a hook helper module if it reduces `hook.ts` without scattering schema logic.
5. Keep settings JSON classification and mutation together unless a cleaner boundary emerges.
6. Run `npm test -- test/setup.test.ts test/hook.test.ts test/init-helper.test.ts` and `npm run lint`.
7. Commit as `refactor(v2): split setup and hook helpers`.

## Final Verification

Run:
- `npm test`
- `npm run build`
- `npm run lint`

Then request one review pass over the new commits. Fix and commit any must-fix or should-fix findings before final handoff.
