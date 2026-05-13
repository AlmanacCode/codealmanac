---
title: Legacy SessionEnd Hook
summary: Hook-based auto-capture is historical; scheduler-backed quiet-session capture supersedes it.
topics: [agents, flows, cli]
files:
  - src/commands/automation.ts
  - src/commands/setup.ts
  - src/commands/uninstall.ts
sources:
  - /Users/kushagrachitkara/.codex/sessions/2026/05/11/rollout-2026-05-11T14-32-08-019e18f4-5e73-7790-ba49-73cc02544a58.jsonl
verified: 2026-05-13
archived_at: 2026-05-13
superseded_by: capture-automation
---

# Legacy SessionEnd Hook

Hook-based auto-capture is no longer the current product path. [[capture-automation]] supersedes it with scheduler-backed quiet-session capture: `almanac automation install` registers an OS scheduler job, and the job periodically runs `almanac capture sweep`. The current scheduler-owned automation surface itself is described in [[lifecycle-cli]] and [[install-time-node-launcher]].

This page remains only as historical context for cleanup and migration. Earlier versions installed a shared `almanac-capture.sh` command into provider hook configs: Claude used `SessionEnd`, Codex used `Stop`, and Cursor used `sessionEnd`. That shape was removed from onboarding and the public command surface because each provider exposes different lifecycle semantics, and Codex `Stop` is turn-scoped rather than a reliable session boundary.

## Current invariant

Automatic capture is scheduler-only. `almanac capture sweep` is the only automatic path that decides transcript eligibility, quiet-window timing, cursor dedupe, and capture enqueueing. No hook path should bypass [[capture-ledger]].

Setup and uninstall still clean legacy hook entries privately. [[src/commands/automation.ts]] removes CodeAlmanac-owned commands whose `command` contains `almanac-capture.sh`, including wrapped and unwrapped hook shapes, while preserving unrelated user hooks.

## Legacy shapes to keep cleaning

Future migration code should keep recognizing these observed provider-era shapes:

- Claude: `~/.claude/settings.json` with `SessionEnd`
- Codex: `~/.codex/hooks.json` with `Stop`
- Cursor: `~/.cursor/hooks.json` with `sessionEnd`

The cleanup rule is content-based, not only key-based. It should remove the CodeAlmanac command object, then prune empty wrapper arrays and empty hook containers so setup and uninstall heal old machines in place.

## Debugging posture

When automatic capture does not run, inspect scheduler state first:

```bash
almanac doctor
almanac automation status
almanac capture sweep --dry-run --json
almanac jobs
```

Hook config files under `~/.claude/`, `~/.codex/`, and `~/.cursor/` are now legacy cleanup targets, not active CodeAlmanac automation state. If a machine still has `almanac-capture.sh` entries, rerun `almanac setup` or `almanac automation install` to install scheduler-backed capture and clean the old entries.
