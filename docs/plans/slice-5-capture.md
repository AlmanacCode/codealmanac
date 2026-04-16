# Slice 5 — Capture (writer + reviewer via SessionEnd hook)

Fifth implementation slice of codealmanac. Builds on slices 1-4. Reuses the `agent/sdk.ts` wrapper from slice 4, adds the subagent pattern (writer → reviewer).

## Read before coding

1. **SDK implementation reference (read FIRST):** `~/Desktop/Projects/codealmanac/docs/research/agent-sdk.md`
   Version, auth, message types, subagent routing, streaming format, pitfalls. §6 and §11 specifically cover the subagent pattern slice 5 needs.

2. **Design spec:** `/Users/rohan/Desktop/Projects/openalmanac/docs/ideas/codebase-wiki.md`
   Focus on: Writer/Reviewer Pipeline, SessionEnd hook, writer + reviewer subagent architecture.

3. **The prompts that drive the agents:**
   - `~/Desktop/Projects/codealmanac/prompts/writer.md`
   - `~/Desktop/Projects/codealmanac/prompts/reviewer.md`
   Read both in full. They define the behavior; this slice is the harness.

4. **Slice 4 code** — reuse `src/agent/sdk.ts` and `src/agent/prompts.ts`. Extend if needed; don't duplicate.

5. **GUI precedent** (already summarized in `docs/research/agent-sdk.md`, read only if you need more context):
   - `/Users/rohan/Desktop/Projects/openalmanac/gui/main/agent-definitions.js` — `AgentDefinition` shape
   - `/Users/rohan/Desktop/Projects/openalmanac/gui/process-manager.js` — `query({ prompt, options: { ..., agents } })`
   - `/Users/rohan/Desktop/Projects/openalmanac/prompts/article-writer.md` — how writer prompt dispatches to subagents

6. **Claude Code's SessionEnd hook docs** — know what input the hook receives (session_id, transcript_path, cwd), what exit codes mean.

## Scope

### `almanac capture`

```bash
almanac capture                              # runs writer agent on latest session transcript
almanac capture <transcript-path>            # explicit transcript file
almanac capture --session <id>               # target specific session by ID
almanac capture --quiet                      # suppress streaming output
almanac capture --model <model>              # override model
```

**Default behavior:**
1. Resolve transcript path. If not given, find the most recent transcript from Claude Code's session storage (typically `~/.claude/projects/<project-hash>/<session-id>.jsonl` or similar — check the SDK docs / Claude Code docs).
2. Resolve repo root (walk up for `.almanac/`)
3. Refuse if no `.almanac/` (tell user to run `almanac init` or `almanac bootstrap`)
4. Load `prompts/writer.md` and `prompts/reviewer.md`
5. Invoke SDK `query()` with:
   - `systemPrompt`: writer prompt
   - `prompt`: `"Capture this coding session. Transcript: <transcript-path>. Working directory: <repoRoot>."`
   - `allowedTools`: `["Read", "Write", "Edit", "Glob", "Grep", "Bash", "Agent"]`
   - `agents`: `{ reviewer: { description, prompt: reviewerPrompt, tools: ["Read", "Grep", "Glob", "Bash"] } }`
   - `cwd`: repo root
6. Stream messages. Format similar to bootstrap but emphasize:
   - When writer invokes reviewer (show the delegation)
   - When pages are written
   - Final summary: N pages updated/created/archived, cost
7. Write full transcript to `.almanac/.capture-<session-id>.log`

### Hook script — user-installable

Ship a hook script at `hooks/almanac-capture.sh` (bundled in the npm package) that users can wire into Claude Code's `SessionEnd` hook. Example content:

```bash
#!/bin/bash
# codealmanac SessionEnd hook
# Fires when a Claude Code session ends; runs almanac capture in background.

set -u

INPUT=$(cat)
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')
TRANSCRIPT=$(echo "$INPUT" | jq -r '.transcript_path // empty')
CWD=$(echo "$INPUT" | jq -r '.cwd // empty')

[ -z "$TRANSCRIPT" ] && exit 0
[ -z "$CWD" ] && exit 0

# Only run if the cwd has a .almanac/ (walk up)
DIR="$CWD"
while [ "$DIR" != "/" ]; do
  if [ -d "$DIR/.almanac" ]; then
    # Run capture in background, non-blocking
    (
      cd "$DIR"
      almanac capture "$TRANSCRIPT" --session "$SESSION_ID" --quiet \
        > "$DIR/.almanac/.capture-$SESSION_ID.log" 2>&1
    ) &
    exit 0
  fi
  DIR=$(dirname "$DIR")
done

# No .almanac/ found — no-op
exit 0
```

Ship this file; document its installation in README. Don't auto-install — the user runs `almanac hook install` or manually adds to `.claude/settings.json`.

### `almanac hook install` — convenience command

```bash
almanac hook install                         # adds SessionEnd hook to user's ~/.claude/settings.json
almanac hook uninstall                       # removes it
almanac hook status                          # reports whether it's installed
```

Implementation:
- Read `~/.claude/settings.json` (create if missing)
- Add/remove/check the `SessionEnd` hook entry pointing at the bundled script
- Idempotent; never double-add
- If hook already exists with a different command, show a warning and refuse to overwrite — user resolves manually

This is the only exception to "no interactive prompts" — because the alternative is users manually editing Claude Code settings. The install command is itself non-interactive; it just modifies a JSON file.

## Out of scope

- `almanac graph` / `almanac diff` (later polish)
- Cross-wiki capture (capture runs against the current repo's wiki only)
- Transcript parsing utilities (the agent reads the transcript itself via Read tool; we pass the path)

## Design decisions

### Subagent invocation via SDK

Follow the GUI's pattern exactly. Agent definitions look like:

```typescript
const agents: Record<string, AgentDefinition> = {
  reviewer: {
    description:
      "Reviews proposed wiki changes against the full knowledge base for " +
      "cohesion, duplication, missing links, notability, and writing conventions.",
    prompt: reviewerPromptText,
    tools: ["Read", "Grep", "Glob", "Bash"],
  },
};
```

The writer invokes the reviewer via the `Agent` tool in its tool calls. The SDK routes automatically. No custom routing code needed — just the `agents` key in `query()` options.

### Writer's tools

- `Read` — read session transcript, existing wiki pages
- `Write` — create new pages
- `Edit` — update existing pages
- `Glob`, `Grep` — navigate the wiki + source code
- `Bash` — run `almanac search`, `almanac show`, `almanac info`, `almanac list` to interrogate the graph
- `Agent` — invoke the reviewer

### Reviewer's tools (intentionally read-only)

- `Read`, `Grep`, `Glob` — inspect wiki pages
- `Bash` — run `almanac search/show/info/list` to verify graph facts
- No `Write`, `Edit`, `Agent`

Enforced by the SDK based on the `tools` field in the agent definition. This is the only mechanism preventing the reviewer from editing files directly.

### Transcript resolution

If no path given, find the most recent transcript:
- Claude Code stores transcripts at `~/.claude/projects/<project-hash>/<session-id>.jsonl` (verify exact path via docs)
- "Latest" = most recently modified
- Scope to transcripts that mention `cwd` matching the current repo (if possible)
- If ambiguous, exit with error asking for explicit `--session` or `<transcript-path>`

### Behavior when writer produces nothing

Per the writer prompt: "If you decide nothing in the session meets the bar, write nothing. That's a valid outcome."

If no files are written, `almanac capture` exits 0 with a message:
```
[capture] no new knowledge met the notability bar (0 pages written)
[capture] transcript: ~/.claude/projects/.../session-abc123.jsonl
[capture] log: .almanac/.capture-abc123.log
```

This is a success, not an error.

### Streaming output

Same format style as slice 4. Highlights:

```
[capture] starting writer (session abc123)
[writer] reading transcript
[writer] searching for 'pydantic ai'
[writer] reading .almanac/pages/pydantic-ai.md
[writer] drafting updates to pydantic-ai.md
[writer] invoking reviewer subagent
[reviewer] reading proposed changes
[reviewer] searching for related pages
[reviewer] approved with 2 notes (missing wikilink; section needs cohesion pass)
[writer] applying reviewer feedback
[writer] wrote .almanac/pages/pydantic-ai.md
[capture] done (1 page updated, 0 created, 0 archived, cost: $0.08)
```

Tool calls show up as `[writer] <action>` or `[reviewer] <action>` with a single-line summary. Full transcript goes to the log file.

`--quiet` suppresses all but the final summary line.

## Authentication + reliability

Same as slice 4: auth comes from Claude Code's existing auth store. Surface errors clearly.

**Non-blocking failures:** if capture fails for any reason (network, auth, agent error), exit 1 with a clear message but don't break the user's workflow. The hook script backgrounds the call and redirects output to the log, so hook failure doesn't interrupt the user. Capture failures are annoying, not fatal — the wiki can be updated manually or on a future session.

## Testing

Integration tests for `capture` are hard (real agent calls, cost). Strategy:

1. **Unit tests for the harness**: mock `runAgent`, verify
   - Command wiring (flags, transcript resolution, repo root detection)
   - Refuses when no `.almanac/`
   - Log file is created
   - `--quiet` suppresses streaming
   - Output format correct for different message types
2. **Hook install/uninstall unit tests**: mock `~/.claude/settings.json`, verify idempotency, refusal to overwrite foreign entries
3. **Manual end-to-end**: run `almanac capture` with a real transcript from a real session, inspect the resulting wiki changes

Don't add an always-on CI integration test that makes real agent calls. Too expensive, too flaky.

## What "done" looks like

```bash
cd ~/some-repo
# (Assume you've done init + bootstrap earlier. Some pages exist.)

# Simulate a session where you worked on auth:
# ... user does Claude Code work ...
# ... Claude Code session ends ...

almanac capture
# [capture] resolving latest transcript: ~/.claude/projects/.../abc123.jsonl
# [capture] repo root: /Users/you/some-repo
# [capture] starting writer
# [writer] reading transcript
# [writer] found session focused on auth refactor
# [writer] searching --mentions src/auth/
# [writer] reading .almanac/pages/jwt-vs-sessions.md
# [writer] drafting update
# [writer] invoking reviewer
# [reviewer] approved — one note: missing link to [[session-middleware]]
# [writer] adding the link
# [writer] wrote .almanac/pages/jwt-vs-sessions.md
# [capture] done (1 updated, 0 created, 0 archived, cost: $0.07)

git status
# modified: .almanac/pages/jwt-vs-sessions.md

# Explicit transcript:
almanac capture /path/to/transcript.jsonl --session specific-id
# (same flow)

# Hook install:
almanac hook install
# ✓ SessionEnd hook installed in ~/.claude/settings.json

almanac hook status
# SessionEnd hook: installed
# Script: /Users/you/.npm/lib/node_modules/codealmanac/hooks/almanac-capture.sh

almanac hook uninstall
# ✓ SessionEnd hook removed

# Quiet mode:
almanac capture --quiet
# [capture] done (1 updated, 0 created, 0 archived, cost: $0.07)

# Empty session (nothing notable):
almanac capture /path/to/trivial-session.jsonl
# [capture] done — no new knowledge met the notability bar (0 pages written)
```

## Design rules (non-negotiable)

- **Writer owns outcomes.** No approve/revise/reject state machine in code. The writer's prompt handles incorporating reviewer feedback.
- **Reviewer is read-only.** Enforced by tool scoping in the agent definition.
- **No pipeline artifacts.** No proposal files, no `--dry-run` flag, no intermediate review step. The writer writes directly.
- **Silent empty outcomes.** Writer producing no files is valid; exit 0 with a clear "nothing written" message.
- **Non-blocking hook.** The hook script backgrounds capture with `&` and redirects to a log; session end never waits on capture.
- **Hook install is idempotent** and refuses to overwrite foreign entries.
- **Full transcript always written to `.almanac/.capture-<session>.log`.** Gitignored.

## Commit template

```
feat(slice-5): almanac capture — writer + reviewer subagent via SessionEnd

- src/commands/capture.ts: invokes writer with reviewer subagent
- Reviewer scoped to read-only tools (Read, Grep, Glob, Bash)
- Transcript auto-resolution; --session / explicit path overrides
- hooks/almanac-capture.sh: user-installable SessionEnd hook
- src/commands/hook.ts: almanac hook install/uninstall/status
- Streaming output with tool-call formatting; --quiet mode; full log sidecar
- Empty-capture outcome is valid (no pages written = exit 0)
```

Push to origin/main.

## Report format

1. What was built (files + commands + dependencies added)
2. `npm test` output (unit tests + mocked SDK)
3. Manual verification: real capture against a real transcript; show the diff it produced
4. Hook install/uninstall round-trip verification
5. Git commit hash + push confirmation
6. Judgment calls — especially: transcript path resolution strategy, streaming format, any SDK quirks with subagent definitions
