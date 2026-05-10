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

The hook runs `almanac capture`, which now starts a V1 background job by default. The hook should return quickly after the parent writes the queued run record under [[process-manager-runs]]. Because capture runs headlessly with no terminal attached, provider auth must already be available; Claude can use the saved credential store (`~/.claude/credentials/`) or `ANTHROPIC_API_KEY`.

## What capture auto-resolves

When triggered by the hook with no explicit transcript path, `capture` uses Claude transcript discovery for the current repo. V1 currently supports Claude latest-session and filtered discovery; Codex/Cursor session discovery is future work. See [[capture-flow]] for the current resolver contract.

## Failure behavior

Capture failure during a hook-triggered run produces no visible output in the ended Claude session. The postmortem path is `almanac jobs`, `almanac jobs show <run-id>`, and `almanac jobs logs <run-id>` for the current wiki. `almanac hook status` only confirms the hook is wired.
