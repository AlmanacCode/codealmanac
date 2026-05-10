---
title: SessionEnd Hook
topics: [systems, flows]
files:
  - src/commands/hook.ts
  - hooks/
---

# SessionEnd Hook

The SessionEnd hook wires codealmanac into Claude Code's lifecycle. `almanac hook install` writes a `SessionEnd` entry to `~/.claude/settings.json` that runs `almanac capture` in the background after each Claude Code session ends.

## Settings.json shape

Claude Code validates `settings.json` against a strict schema. Each event array entry (e.g. `SessionEnd`) is a `{ matcher, hooks: [...] }` container; actual command objects live inside the nested `hooks` array. `matcher` is always `""` for `SessionEnd`, which matches every session.

```json
{
  "hooks": {
    "SessionEnd": [
      {
        "matcher": "",
        "hooks": [
          { "type": "command", "command": "/path/to/almanac-capture.sh" }
        ]
      }
    ]
  }
}
```

Versions v0.1.0–v0.1.4 of codealmanac wrote command objects directly at the event-array level; that shape is rejected by newer Claude Code. `almanac hook install` migrates any legacy entry it recognizes (by `command` ending in `almanac-capture.sh`) to the wrapped form on install.

## Script path

The hook script is `hooks/almanac-capture.sh`. On install, `almanac hook install` copies it to `~/.claude/hooks/almanac-capture.sh` (the stable path written into `settings.json`). This path survives npm version bumps, npx cache evictions, and nvm version switches — the settings entry never points at an ephemeral path inside `~/.npm/_npx/<sha>/`.

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
