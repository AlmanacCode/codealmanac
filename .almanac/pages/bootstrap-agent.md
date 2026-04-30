---
title: Bootstrap Agent
topics: [agents, flows]
files:
  - src/commands/bootstrap.ts
  - prompts/bootstrap.md
  - src/agent/sdk.ts
  - src/agent/auth.ts
  - src/agent/prompts.ts
---

# Bootstrap Agent

`almanac bootstrap` spawns a one-shot Claude agent that reads the repo structure and writes initial stub pages + a `topics.yaml` DAG into `.almanac/`. It runs once per repo; subsequent knowledge capture uses [[capture-flow]].

<!-- stub: fill in prompt iteration history and gotchas from real bootstrap runs -->

## Flow

1. Auth gate via `assertClaudeAuth` (fails fast before any filesystem work).
2. Walk-up resolution to find the nearest `.almanac/`; if none exists, `initWiki` is called silently.
3. Refuse-if-populated: if `pages/` contains any `.md` files, exit non-zero unless `--force` is set.
4. Load `prompts/bootstrap.md` from the npm package install path.
5. Run the agent with `allowedTools = ["Read","Write","Edit","Glob","Grep","Bash"]` and `cwd = repoRoot`.
6. Stream tool-use lines to stdout (suppressed with `--quiet`); write raw JSON messages to `.almanac/.bootstrap-<timestamp>.log`.
7. Print `[done] cost: $X.XXX, turns: N (transcript: .bootstrap-*.log)` on success.

## Tool allowlist

Bootstrap is given Read/Write/Edit/Glob/Grep/Bash. No `Agent` tool (no subagent reviewer — that's slice 5 / capture's domain). No `WebFetch`/`WebSearch` — the agent works from the repo only.

## Prompts

`prompts/bootstrap.md` is bundled in `files` in `package.json` and loaded via `src/agent/prompts.ts` which resolves relative to the npm package install path. The prompt instructs the agent to identify anchors (stable named things other pages will link to), group related deps into single entity pages, and write stubs with frontmatter, a one-paragraph intro, a "Where we use it" section, and a `<!-- stub: ... -->` marker. The broader organizational role of anchors, hubs, redirects, and gardening is captured in [[wiki-organization-primitives]].

## StreamingFormatter

`bootstrap.ts` exports `StreamingFormatter`, reused by [[capture-flow]]. It translates `SDKMessage` events into one-line-per-tool-use output. Bash calls show the command (truncated at 80 chars). `Agent` tool-use calls switch the label prefix so subagent output reads `[reviewer] ...` not `[bootstrap] ...`.
