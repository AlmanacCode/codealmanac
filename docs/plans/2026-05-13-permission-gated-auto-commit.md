# Permission-Gated Auto-Commit Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make Almanac wiki auto-commit behavior opt-in instead of unconditional.

**Architecture:** Store a global `auto_commit` boolean in `~/.almanac/config.toml`, defaulting to `false`. Setup asks for it only in interactive mode or enables it through an explicit `--auto-commit` flag, and lifecycle operation prompts receive the resolved setting so agents commit wiki source files only when allowed.

**Tech Stack:** TypeScript, Commander setup wiring, existing TOML config helpers, bundled markdown prompts, Vitest.

---

### Task 1: Config Surface

**Files:**
- Modify: `src/update/config.ts`
- Modify: `src/commands/config-keys.ts`
- Test: `test/config-command.test.ts`

**Steps:**
1. Write a failing test that `auto_commit` defaults to `false`, appears in `config list`, and can be set/unset through `almanac config`.
2. Run the focused config test and confirm it fails because `auto_commit` is unknown.
3. Add `auto_commit: boolean` to `GlobalConfig`, default normalization, origin reporting, TOML parse/serialize, and config key parsing.
4. Run the focused config test and confirm it passes.

### Task 2: Setup Permission

**Files:**
- Modify: `src/commands/setup.ts`
- Modify: `src/cli/register-setup-commands.ts`
- Test: `test/setup.test.ts`

**Steps:**
1. Write failing tests that `--yes` keeps `auto_commit` false and explicit `autoCommit: true` stores true.
2. Run setup tests and confirm failure.
3. Add `autoCommit?: boolean` to setup options, write config after provider selection, and add `--auto-commit` to the CLI.
4. In interactive setup, prompt `Commit Almanac wiki updates automatically?` with default No.
5. Run setup tests and confirm they pass.

### Task 3: Operation Prompt Gate

**Files:**
- Modify: `src/operations/run.ts`
- Modify: `prompts/base/syntax.md`
- Test: `test/build-operation.test.ts`
- Test: `test/absorb-operation.test.ts`

**Steps:**
1. Write failing tests that operation specs include auto-commit disabled by default and enabled when config says true.
2. Run focused operation tests and confirm failure.
3. Read resolved config in `createOperationRunSpec()` and append source-control runtime context.
4. Change the Source Control Hygiene prompt from unconditional commit to conditional commit.
5. Run focused operation tests and confirm they pass.

### Task 4: Docs and Wiki Memory

**Files:**
- Modify: `README.md`
- Modify: `guides/reference.md`
- Modify: `.almanac/pages/lifecycle-cli.md` or related wiki page

**Steps:**
1. Document `--auto-commit` and `auto_commit`.
2. Update the wiki page that owns lifecycle/setup behavior with the new permission rule.
3. Run targeted tests and then `npm test`.
