---
title: SessionEnd Hook
topics: [systems, flows]
files:
  - src/commands/hook.ts
  - hooks/
---

# SessionEnd Hook

The SessionEnd hook wires codealmanac into Claude Code's lifecycle. `almanac hook install` writes a `SessionEnd` entry to `~/.claude/settings.json` that runs `almanac capture` in the background after each Claude Code session ends.

<!-- stub: fill in the exact settings.json shape, backgrounding behavior, and failure modes as discovered -->

## Install/uninstall

`almanac hook install` — adds the SessionEnd entry; idempotent (re-running is safe).
`almanac hook uninstall` — removes codealmanac's entry; leaves all other entries in `hooks` untouched.
`almanac hook status` — reports whether the hook is installed, without modifying anything.

## Backgrounding

The hook runs `almanac capture` backgrounded so the Claude Code session exit is not blocked. Because capture runs headlessly with no terminal attached, auth must be via the saved credential store (`~/.claude/credentials/`) rather than interactive login. `ANTHROPIC_API_KEY` also works if set in the environment.

## What capture auto-resolves

When triggered by the hook (no explicit transcript path), `capture` auto-resolves the most recent transcript under `~/.claude/projects/` whose `cwd` matches the current repo. This is the normal path for automated captures.

## Failure behavior

Capture failure during a hook-triggered run produces no visible output (the session has already ended). Errors are written to the `.capture-*.log` file in `.almanac/`. `almanac hook status` can confirm the hook is wired; examining the log file is the postmortem path.
