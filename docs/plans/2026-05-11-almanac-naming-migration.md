# Almanac Naming Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the product consistently present itself as Almanac while keeping the npm package name `codealmanac` because `almanac` is not cleanly available on npm.

**Architecture:** Preserve the package/runtime layout and update the user-facing contract around it. The npm package remains `codealmanac`; `almanac` is the canonical command and `alm` is the short alias. Keep the `codealmanac` bin as a compatibility/npx bootstrap alias because `npx codealmanac` requires a matching executable when the package exposes multiple bins. Setup, guides, uninstall, doctor, docs, and tests move from `codealmanac` wording/artifacts to `almanac` wording/artifacts while retaining legacy cleanup for old beta installs.

**Tech Stack:** TypeScript CLI with Commander, npm package `bin` metadata, Vitest, Node filesystem APIs, Claude Code settings/guides integration.

---

## Decisions

- Product/app name: **Almanac**.
- npm package name: `codealmanac`.
- Canonical user-facing binaries: `almanac`, `alm`.
- Keep the `codealmanac` binary as a compatibility/npx bootstrap alias, but do not teach it as the daily command after install.
- Home state/config directory remains `~/.almanac`.
- Repo-local wiki directory remains `.almanac/`.
- Hook script remains `almanac-capture.sh`.
- Claude guide files become `~/.claude/almanac.md` and `~/.claude/almanac-reference.md`.
- Claude import line becomes `@~/.claude/almanac.md`.
- Command nouns stay as-is: `init`, `capture`, `ingest`, `garden`, `doctor`, `agents`, `config`, `hook`, `jobs`, etc.
- Internal env/config naming stays `ALMANAC_*` / `.almanac`.
- Legacy cleanup must still remove old `codealmanac` guide files, import lines, and caches where applicable.

## Non-Goals

- Do not rename the npm package to `almanac`.
- Do not rename `.almanac/` or `~/.almanac`.
- Do not rename `hooks/almanac-capture.sh`.
- Do not change command behavior beyond bare `almanac` setup routing and user-facing names.
- Do not introduce a hosted service, new config location, or alternate link syntax.

## Read Before Coding

- `AGENTS.md` instructions in the conversation.
- `package.json` for package name, `bin`, `files`, and scripts.
- `src/cli.ts` for binary-name based setup routing and program description.
- `src/install/global.ts` for `npx codealmanac` durable bootstrap.
- `src/commands/setup.ts` for setup banner, guide install, import line, and ephemeral install copy.
- `src/commands/uninstall.ts` for guide/import removal.
- `src/commands/hook.ts` and `src/commands/hook/script.ts` for hook path ownership and migration.
- `src/commands/doctor-checks/install.ts` and `src/commands/doctor-checks/format.ts` for install diagnostics.
- `README.md` for public install/setup docs.

## Task 1: Lock Binary Contract

**Files:**
- Modify: `package.json`
- Modify: `src/cli.ts`
- Modify: `bin/codealmanac.ts`
- Test: `test/cli.test.ts`

**Step 1: Write failing tests for the new binary contract**

In `test/cli.test.ts`, update/add tests so:

- `almanac` with no args routes to setup.
- `almanac --yes`, `almanac --skip-hook`, `almanac --skip-guides`, `almanac --agent codex`, and `almanac --model <model>` route to setup.
- `almanac doctor`, `almanac search foo`, and `almanac --yes doctor` do not route to the setup shortcut.
- `codealmanac` remains supported as an npx/bootstrap compatibility alias, but tests should describe it that way rather than as the primary command.

**Step 2: Run the focused test and verify it fails**

Run:

```bash
npm test -- test/cli.test.ts
```

Expected: failures around old `codealmanac` setup shortcut expectations.

**Step 3: Update package bin metadata**

In `package.json`, keep:

```json
"bin": {
  "codealmanac": "dist/codealmanac.js",
  "almanac": "dist/codealmanac.js",
  "alm": "dist/codealmanac.js"
}
```

Rationale: `npx codealmanac` needs a matching `codealmanac` bin because the package exposes multiple bins. Keep `"name": "codealmanac"`.

**Step 4: Update setup shortcut routing**

In `src/cli.ts`:

- Route setup-compatible bare invocations when `programName === "almanac"` or `programName === "codealmanac"`.
- Treat `codealmanac` as compatibility/npx bootstrap wording, not the canonical daily command.
- Update comments and descriptions from "`codealmanac` bare binary" to "`almanac` bare invocation".
- Keep explicit `almanac setup` working through the sqlite-free command path.

In `bin/codealmanac.ts`:

- Update the ABI guard comments.
- Update shortcut skip logic so bare `almanac` setup-compatible invocations can bypass the sqlite ABI check.

**Step 5: Run focused tests**

Run:

```bash
npm test -- test/cli.test.ts
```

Expected: pass.

**Step 6: Commit**

```bash
git add package.json src/cli.ts bin/codealmanac.ts test/cli.test.ts
git commit -m "refactor: make almanac the canonical CLI binary"
```

## Task 2: Preserve `npx codealmanac` as Install Bootstrap

**Files:**
- Modify: `src/install/global.ts`
- Modify: `src/commands/setup/install-path.ts`
- Test: `test/global-bootstrap.test.ts`
- Test: `test/setup.test.ts`

**Step 1: Write/adjust tests**

Update tests to assert:

- `npx codealmanac` still installs `codealmanac@latest` globally.
- After bootstrap, setup is rerun from the global package entrypoint.
- The durable user command reported by setup is `almanac`.
- Error hints still say `npm install -g codealmanac` for package install, but user command hints say `almanac`.

**Step 2: Run focused tests and verify failures**

Run:

```bash
npm test -- test/global-bootstrap.test.ts test/setup.test.ts
```

Expected: failures where tests still expect `codealmanac` as the setup surface or guide filename.

**Step 3: Update bootstrap wording, not package mechanics**

In `src/install/global.ts`:

- Keep global install command `npm i -g codealmanac@latest`.
- Keep global package root resolution at `<npm root -g>/codealmanac`.
- Update comments and user-facing errors to distinguish package from command:
  - package: `codealmanac`
  - command: `almanac`

In `src/commands/setup/install-path.ts`:

- Keep package manifest detection for `name === "codealmanac"`.
- Keep install command `npm install -g codealmanac@latest`.
- Update comments and user hints to say the installed command is `almanac`.

**Step 4: Run focused tests**

Run:

```bash
npm test -- test/global-bootstrap.test.ts test/setup.test.ts
```

Expected: pass or only guide-name failures that Task 3 intentionally handles.

**Step 5: Commit**

```bash
git add src/install/global.ts src/commands/setup/install-path.ts test/global-bootstrap.test.ts test/setup.test.ts
git commit -m "refactor: keep codealmanac package bootstrap for almanac CLI"
```

## Task 3: Rename Guide Artifacts With Legacy Cleanup

**Files:**
- Modify: `src/commands/setup.ts`
- Modify: `src/commands/uninstall.ts`
- Modify: `src/commands/doctor-checks/install.ts`
- Test: `test/setup.test.ts`
- Test: `test/uninstall.test.ts`
- Test: `test/doctor.test.ts`

**Step 1: Write failing guide tests**

Update tests so new setup writes:

```text
~/.claude/almanac.md
~/.claude/almanac-reference.md
~/.claude/CLAUDE.md containing @~/.claude/almanac.md
```

Add uninstall/doctor tests that cover legacy cleanup:

```text
~/.claude/codealmanac.md
~/.claude/codealmanac-reference.md
@~/.claude/codealmanac.md
```

Expected behavior:

- setup installs only new guide filenames.
- setup does not duplicate imports when the new import exists.
- uninstall removes both new and old guide files/import lines.
- doctor accepts the new guide files and reports missing new names.

**Step 2: Run focused tests and verify failures**

Run:

```bash
npm test -- test/setup.test.ts test/uninstall.test.ts test/doctor.test.ts
```

Expected: failures around guide filenames and `IMPORT_LINE`.

**Step 3: Update setup guide install**

In `src/commands/setup.ts`:

- Change guide destination files to `almanac.md` and `almanac-reference.md`.
- Change `IMPORT_LINE` to `@~/.claude/almanac.md`.
- Update setup prose from `codealmanac` to `Almanac` where it is product-facing.
- Keep package-install hints as `npm install -g codealmanac`.
- Keep `hasImportLine` tolerant of annotated import lines for the new path.

**Step 4: Update uninstall to remove current and legacy files**

In `src/commands/uninstall.ts`:

- Remove new files: `almanac.md`, `almanac-reference.md`.
- Also remove legacy files: `codealmanac.md`, `codealmanac-reference.md`.
- Remove new import line via `IMPORT_LINE`.
- Also remove legacy import line `@~/.claude/codealmanac.md`.
- Keep unrelated `CLAUDE.md` content untouched.
- If `CLAUDE.md` becomes empty after removing only Almanac import lines, delete it.

**Step 5: Update doctor install checks**

In `src/commands/doctor-checks/install.ts`:

- Check for `almanac.md` and `almanac-reference.md`.
- Check `CLAUDE.md` for `@~/.claude/almanac.md`.
- Optional: warn or self-describe clearly if only legacy `codealmanac*.md` files are present.

**Step 6: Run focused tests**

Run:

```bash
npm test -- test/setup.test.ts test/uninstall.test.ts test/doctor.test.ts
```

Expected: pass.

**Step 7: Commit**

```bash
git add src/commands/setup.ts src/commands/uninstall.ts src/commands/doctor-checks/install.ts test/setup.test.ts test/uninstall.test.ts test/doctor.test.ts
git commit -m "refactor: rename agent guides to almanac"
```

## Task 4: Product Wording Pass

**Files:**
- Modify: `src/commands/agents.ts`
- Modify: `src/commands/config.ts`
- Modify: `src/commands/update.ts`
- Modify: `src/update/announce.ts`
- Modify: `src/commands/doctor-checks/format.ts`
- Modify: `src/commands/doctor-checks/install.ts`
- Modify: `src/cli/register-setup-commands.ts`
- Modify: `src/cli/register-wiki-lifecycle-commands.ts`
- Test: `test/update.test.ts`
- Test: `test/update-announce.test.ts`
- Test: `test/doctor.test.ts`
- Test: `test/deprecations.test.ts`

**Step 1: Update tests to prefer Almanac wording**

Expected conventions:

- Product/status headers say `Almanac`.
- Error prefixes may remain `almanac:` because that is the CLI command.
- Package install/update commands say `codealmanac@latest`.
- User commands say `almanac`.

**Step 2: Run focused tests and verify failures**

Run:

```bash
npm test -- test/update.test.ts test/update-announce.test.ts test/doctor.test.ts test/deprecations.test.ts
```

Expected: wording assertion failures.

**Step 3: Update user-facing strings**

Sweep only user-facing strings and comments that explain user behavior. Preserve internal identifiers and package references where they must remain `codealmanac`.

Examples:

- `codealmanac v0.1.3` -> `Almanac v0.1.3`
- `codealmanac agents` -> `Almanac agents`
- `codealmanac: updated.` -> `almanac: updated.` or `Almanac updated.`; choose one convention and make tests match.
- `install the latest codealmanac` -> `install the latest Almanac package`
- `npm i -g codealmanac@latest` remains unchanged.

**Step 4: Run focused tests**

Run:

```bash
npm test -- test/update.test.ts test/update-announce.test.ts test/doctor.test.ts test/deprecations.test.ts
```

Expected: pass.

**Step 5: Commit**

```bash
git add src/commands/agents.ts src/commands/config.ts src/commands/update.ts src/update/announce.ts src/commands/doctor-checks/format.ts src/commands/doctor-checks/install.ts src/cli/register-setup-commands.ts src/cli/register-wiki-lifecycle-commands.ts test/update.test.ts test/update-announce.test.ts test/doctor.test.ts test/deprecations.test.ts
git commit -m "refactor: present the product as Almanac"
```

## Task 5: Documentation And Guides

**Files:**
- Modify: `README.md`
- Modify: `guides/mini.md`
- Modify: `guides/reference.md`
- Modify: `docs/plans/2026-05-07-agent-first-cli-surface.md` only if it is treated as current user-facing design; otherwise leave old plans as historical records.

**Step 1: Update README install docs**

README should teach:

```bash
npx codealmanac
```

for one-shot setup/bootstrap, and:

```bash
npm install -g codealmanac
almanac
```

for explicit install/setup.

It should explain:

```text
Install package: codealmanac
Use command: almanac
Short alias: alm
```

Remove references that tell users to run `codealmanac` directly after install.

**Step 2: Update guide files**

In `guides/mini.md` and `guides/reference.md`:

- Use **Almanac** as the product name.
- Use `almanac` for CLI examples.
- Mention `npm install -g codealmanac` only in install/update contexts.

**Step 3: Run docs-adjacent checks**

Run:

```bash
rg -n "codealmanac|code almanac|CodeAlmanac" README.md guides src test package.json
```

Expected:

- `package.json` name/repository URLs may still contain `codealmanac`.
- npm install/update code paths may still contain `codealmanac`.
- Tests may still contain legacy cleanup assertions.
- User-facing command examples should not tell users to run `codealmanac`.

**Step 4: Commit**

```bash
git add README.md guides/mini.md guides/reference.md
git commit -m "docs: clarify install package versus almanac command"
```

## Task 6: Hook Script Verification

**Files:**
- Inspect: `hooks/almanac-capture.sh`
- Modify only if needed: `hooks/almanac-capture.sh`
- Test: `test/hook.test.ts`

**Step 1: Verify hook script command names**

Read `hooks/almanac-capture.sh` and confirm it invokes the correct command after global install:

```bash
almanac capture ...
```

not:

```bash
codealmanac capture ...
```

**Step 2: Keep hook filename unchanged**

Do not rename `hooks/almanac-capture.sh`; it is specific enough to avoid conflicts and already powers legacy hook migration.

**Step 3: Run hook tests**

Run:

```bash
npm test -- test/hook.test.ts
```

Expected: pass.

**Step 4: Commit if edited**

If no source changes were needed, do not commit. If edited:

```bash
git add hooks/almanac-capture.sh test/hook.test.ts
git commit -m "fix: ensure hook invokes almanac command"
```

## Task 7: Clean Slate Recipe For Future Slash Command

**Files:**
- Create or modify only if the repo has a local command/docs home for Codex slash commands.
- Otherwise, record the recipe in the final implementation notes and create the actual slash command outside this repo.

**Step 1: Define cleanup scope**

The clean slate command should remove both current and legacy artifacts:

Current:

```text
npm package: codealmanac
global binaries: almanac, alm
home state: ~/.almanac
guides: ~/.claude/almanac.md, ~/.claude/almanac-reference.md
import: @~/.claude/almanac.md
hook script: ~/.claude/hooks/almanac-capture.sh
npx cache packages: node_modules/codealmanac
```

Legacy:

```text
global binary: codealmanac
guides: ~/.claude/codealmanac.md, ~/.claude/codealmanac-reference.md
import: @~/.claude/codealmanac.md
npx cache packages: node_modules/codealmanac
```

**Step 2: Keep repo-local `.almanac/` out of cleanup**

The clean slate command must not delete:

```text
<repo>/.almanac/
```

unless a future explicit flag says to remove a specific test repo's wiki.

**Step 3: Use this command order**

```bash
almanac uninstall --yes || true
npm uninstall -g codealmanac || true
rm -rf "$HOME/.almanac"
rm -f "$HOME/.claude/hooks/almanac-capture.sh"
rm -f "$HOME/.claude/almanac.md" "$HOME/.claude/almanac-reference.md"
rm -f "$HOME/.claude/codealmanac.md" "$HOME/.claude/codealmanac-reference.md"
```

Then remove stale npx package caches:

```bash
find "$HOME/.npm/_npx" -path '*/node_modules/codealmanac' -type d 2>/dev/null |
  while IFS= read -r pkg; do
    rm -rf "$(dirname "$(dirname "$pkg")")"
  done
```

Then verify:

```bash
type -a codealmanac || true
type -a almanac || true
type -a alm || true
npm ls -g --depth=0 codealmanac || true
rg -n "codealmanac|almanac-capture|@~/.claude/almanac.md|@~/.claude/codealmanac.md" "$HOME/.claude/CLAUDE.md" "$HOME/.claude/settings.json" 2>/dev/null || true
```

Expected:

- `codealmanac`, `almanac`, and `alm` are not found.
- global npm package list has no `codealmanac`.
- no guide/import/hook references remain.

## Task 8: Full Verification

**Files:**
- All changed files.

**Step 1: Run lint**

Run:

```bash
npm run lint
```

Expected: pass.

**Step 2: Run full tests**

Run:

```bash
npm test
```

Expected: pass.

**Step 3: Build**

Run:

```bash
npm run build
```

Expected: pass and produce `dist/`.

**Step 4: Local link smoke**

Run:

```bash
npm link
type -a almanac
type -a alm
type -a codealmanac || true
almanac --version
almanac --help
almanac setup --yes --skip-hook --skip-guides
```

Expected:

- `almanac` and `alm` resolve.
- `codealmanac` does not resolve from this package.
- version/help work.
- setup skip path exits successfully with honest "nothing to install" wording.

**Step 5: Optional fresh npx smoke after publish only**

Do not run before publishing a package containing the rename. After publish:

```bash
npx codealmanac --yes --skip-hook --skip-guides
```

Expected:

- installs or verifies global `codealmanac@latest`.
- leaves `almanac` on PATH.
- does not install guides/hook due to skip flags.

**Step 6: Final commit if needed**

If previous tasks were not committed individually:

```bash
git status --short
npm run lint
npm test
git add package.json README.md guides src test bin hooks
git commit -m "refactor: align CLI naming around Almanac"
```
