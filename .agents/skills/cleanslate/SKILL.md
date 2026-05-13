---
name: cleanslate
description: Use when the user asks to run or prepare the Almanac clean-slate workflow, uninstall all local codealmanac/Almanac CLI artifacts, or reset a machine to first-time Almanac install state.
---

# Almanac Clean Slate

Reset this machine to a first-time Almanac user state, then report exactly what changed.

Goal: remove every installed or cached `codealmanac`/Almanac CLI artifact from this laptop without touching unrelated user files, unrelated npm packages, or foreign editor hooks.

Work from safest to most direct:

1. Record the starting state:
   - `command -v almanac alm codealmanac || true`
   - `npm list -g codealmanac --depth=0 || true`
   - `find ~/.npm/_npx -path '*/node_modules/codealmanac/package.json' -print 2>/dev/null || true`
   - Check for `~/.almanac`, `~/.claude/almanac.md`, `~/.claude/almanac-reference.md`, legacy `~/.claude/codealmanac*.md`, `~/.claude/hooks/almanac-capture.sh`, `~/.codex/hooks.json`, and `~/.cursor/hooks.json`.

2. If any Almanac CLI command exists, run the product uninstaller first:
   - Prefer `almanac uninstall --yes`.
   - If `almanac` is missing but `codealmanac` exists, run `codealmanac uninstall --yes`.
   - If both fail, continue with manual cleanup.

3. Remove npm/global installs and caches:
   - Run `npm uninstall -g codealmanac || true`.
   - Remove `codealmanac` package directories under all local nvm global roots if they still exist.
   - Remove global bin shims named `almanac`, `alm`, and `codealmanac` only when they point at a `codealmanac` install.
   - Remove each `~/.npm/_npx/<hash>` directory whose `node_modules/codealmanac/package.json` exists.

4. Remove Almanac home/config artifacts:
   - Remove `~/.almanac`.
   - Remove `~/.claude/almanac.md`, `~/.claude/almanac-reference.md`, `~/.claude/codealmanac.md`, and `~/.claude/codealmanac-reference.md`.
   - Remove `~/.claude/hooks/almanac-capture.sh` if it exists.

5. Clean editor hook settings safely:
   - In `~/.claude/settings.json`, remove only hook commands whose command path ends with `almanac-capture.sh`; preserve every foreign hook.
   - In `~/.codex/hooks.json`, remove only hook commands whose command path ends with `almanac-capture.sh`; preserve every foreign hook.
   - In `~/.cursor/hooks.json`, remove only hook commands whose command path ends with `almanac-capture.sh`; preserve every foreign hook.
   - If a hook container becomes empty after removing Almanac's command, remove that empty container/key.

6. Clean Claude imports safely:
   - In `~/.claude/CLAUDE.md`, remove lines that are exactly `@~/.claude/almanac.md` or `@~/.claude/codealmanac.md`, plus those same lines followed by spaces/tabs and annotations.
   - Preserve lines that merely mention those paths inside other prose.
   - If `CLAUDE.md` becomes empty after removing Almanac imports, remove it.

7. Verify the clean slate:
   - `hash -r || true`
   - `command -v almanac alm codealmanac || true`
   - `npm list -g codealmanac --depth=0 || true`
   - `find ~/.npm/_npx -path '*/node_modules/codealmanac/package.json' -print 2>/dev/null || true`
   - Check that `~/.almanac`, guide files, and `almanac-capture.sh` are gone.
   - Check that no hook command ending in `almanac-capture.sh` remains in Claude, Codex, or Cursor hook settings.

Output:

- Show the exact commands/actions you ran in order.
- Mark each as `removed`, `already absent`, or `skipped` with the reason.
- End with the remaining `command -v` and npm/global/npx verification output.
