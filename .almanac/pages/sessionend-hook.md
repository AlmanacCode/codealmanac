---
title: SessionEnd Hook
summary: `almanac hook install` wires the shared capture script into Claude, Codex, and Cursor with agent-specific hook shapes and timing behavior.
topics: [agents, flows, cli]
files:
  - src/commands/hook.ts
  - hooks/almanac-capture.sh
  - src/cli/register-wiki-lifecycle-commands.ts
  - test/hook.test.ts
sources:
  - /Users/kushagrachitkara/.codex/sessions/2026/05/11/rollout-2026-05-11T14-32-08-019e18f4-5e73-7790-ba49-73cc02544a58.jsonl
verified: 2026-05-11
---

# SessionEnd Hook

`almanac hook install` wires one shared `hooks/almanac-capture.sh` script into each supported agent app, but the event name and config file differ by app. Claude uses `SessionEnd` in `~/.claude/settings.json`, Codex uses `Stop` in `~/.codex/hooks.json`, and Cursor uses `sessionEnd` in `~/.cursor/hooks.json`.

The shared script backgrounds `almanac capture` after the session transcript is available. This makes hook installation part of the capture pipeline, not a Claude-only feature.

A 2026-05-11 capture session verified the main Codex-specific invariant behind this mapping: current Codex builds expose `Stop` as the usable lifecycle hook surface, not a working `SessionEnd` event. For Almanac, "Codex hook support" therefore means "debounced quiet-session capture after `Stop`," not "capture exactly once when a thread is permanently closed."

## Agent-specific install targets

Claude uses a wrapped `SessionEnd` hook entry in `~/.claude/settings.json`.

Codex uses a wrapped `Stop` hook entry in `~/.codex/hooks.json`. `almanac hook install --source codex` also ensures `codex_hooks = true` in `~/.codex/config.toml`, because Codex will not emit hook callbacks unless that feature flag is enabled.

Cursor uses a flat `sessionEnd` hook entry in `~/.cursor/hooks.json`.

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

The hook script is `hooks/almanac-capture.sh`. On install, `almanac hook install` copies it to `~/.claude/hooks/almanac-capture.sh`, and each agent config points at that stable path. This survives npm version bumps, npx cache evictions, and nvm version switches, so the installed hook never depends on an ephemeral package-manager path.

## Install/uninstall

`almanac hook install` — adds the configured agent hook entry or entries; idempotent (re-running is safe).
`almanac hook uninstall` — removes Almanac's entry; leaves all other entries in `hooks` untouched.
`almanac hook status` — reports whether the hook is installed, without modifying anything.

`runHookInstall()` already supports `--source <claude|codex|cursor|all>`, but the CLI surface is still asymmetric: `hook uninstall` and `hook status` do not take `--source` today and still default to Claude's `~/.claude/settings.json` path. Future hook UX changes should preserve or intentionally remove that asymmetry rather than assuming all three commands are symmetric now.

## Backgrounding

The hook runs `almanac capture`, which now starts a V1 background job by default. The hook should return quickly after the parent writes the queued run record under [[process-manager-runs]]. Because capture runs headlessly with no terminal attached, provider auth must already be available; Claude can use the saved credential store (`~/.claude/credentials/`) or `ANTHROPIC_API_KEY`.

Codex needs special handling here: `Stop` is turn-scoped, not session-scoped. The shared shell script debounces Codex `Stop` events with a `.almanac/runs/.capture-<session>.debounce` marker and only runs capture after a quiet period. Without that debounce, a long interactive Codex session could trigger capture repeatedly between turns.

## What capture auto-resolves

When triggered by the hook with no explicit transcript path, `capture` uses Claude transcript discovery for the current repo. V1 currently supports Claude latest-session and filtered discovery; Codex/Cursor session discovery is future work. See [[capture-flow]] for the current resolver contract.

## Failure behavior

Capture failure during a hook-triggered run produces no visible output in the ended agent session. The postmortem path is `almanac jobs`, `almanac jobs show <run-id>`, and `almanac jobs logs <run-id>` for the current wiki. `almanac hook status` only confirms the hook is wired.

Hook installs mutate user-level config outside the repo. That means git history answers whether the hook contract was committed, but not whether a local machine is currently wired correctly. Testing a local build can temporarily leave `~/.codex/hooks.json` pointing at the wrong event name even when repo code and tests still expect Codex `Stop`.

## Repo state versus machine state

When debugging "was the hook change committed or pushed?", inspect repo-owned hook files and user-owned config separately.

Repo state lives in `src/commands/hook.ts`, `hooks/almanac-capture.sh`, `test/hook.test.ts`, and this page. `git diff`, `git diff HEAD`, and `git diff origin/<branch>` over those files answer whether the hook contract changed locally, in the current commit, or on the remote branch.

Machine state lives in agent config under the home directory, especially `~/.codex/hooks.json`, `~/.codex/config.toml`, `~/.claude/settings.json`, and `~/.cursor/hooks.json`. Those files are outside the repo, so a bad local `hook_event_name` or stale installed script path can survive even when git shows no hook-related repo changes.
