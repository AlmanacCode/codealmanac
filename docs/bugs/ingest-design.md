# `almanac ingest` — Design

How the unified ingest command works, what each argument does, how the agent gets its instructions, and what happens at each step.

---

## The command

```bash
almanac ingest [sources...] [options]
```

One command replaces `bootstrap` and `capture`. Sources are positional, composable. Depth is a flag. The agent figures out the rest.

---

## Arguments — what each one EXPLICITLY does

### Positional: sources

Sources are positional arguments. They tell `ingest` WHAT to read. Multiple sources combine (union).


| Argument                      | What it is         | What happens internally                                                                                                                                                                                                                                                    |
| ----------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sessions`                    | AI coding sessions | Find session transcripts on disk. Default: all detectable tools. Scope: only sessions whose `cwd` matches the current repo.                                                                                                                                                |
| `.` or any directory path     | A folder to read   | The agent receives the path and reads its contents. If it's the repo root (`.`), the agent explores broadly (deps, configs, source structure). If it's `docs/plans/`, the agent reads each file inside. The agent decides how to handle it — no separate "repo scan" mode. |
| `meeting.md` or any file path | A file to read     | The agent receives the path, reads it, extracts knowledge.                                                                                                                                                                                                                 |
| *(nothing)*                   | Auto-detect        | The hook fires this. Finds the most recent session transcript for the current repo and processes it.                                                                                                                                                                       |


**How the parser distinguishes sources:**

- `sessions` is the only reserved keyword
- Everything else is treated as a filesystem path (file or directory)
- Paths can contain `/`, `.`, or be bare filenames — no ambiguity because `sessions` is the only non-path token

**Examples:**

```bash
almanac ingest                              # hook default: latest session
almanac ingest sessions                     # all AI sessions for this repo
almanac ingest .                            # read the current directory (repo-level exploration)
almanac ingest docs/plans/                  # read a folder of docs
almanac ingest meeting.md                   # read a single file
almanac ingest . sessions                   # repo exploration + all sessions
almanac ingest docs/plans/ meeting.md       # two paths
almanac ingest . sessions docs/plans/       # all three source types combined
```

### Flag: `--tool <name>`

Filters `sessions` to a specific AI tool. Only meaningful when `sessions` is in the source list. Repeatable.

```bash
almanac ingest sessions --tool claude       # Claude Code sessions only
almanac ingest sessions --tool codex        # Codex sessions only
almanac ingest sessions --tool claude --tool codex  # both
almanac ingest sessions                     # all detectable tools (default)
```

### Known tools (auto-detected at these locations):

- `claude` → `~/.claude/projects/<hash>/*.jsonl`
- `codex` → `~/.codex/sessions/**/*.jsonl` (indexed via `~/.codex/state_5.sqlite`)
- `cursor` → `~/Library/Application Support/Cursor/User/globalStorage/state.vscdb`
- `aider` → `.aider.chat.history.md` in the current repo
- `continue` → `~/.continue/sessions/*.json`

Omitting `--tool` = try all known locations, ingest whatever is found.

If `--tool` is used without `sessions` in the source list → error: `--tool requires 'sessions' as a source`.

### Flag: `--since <duration>`

Filters sessions by recency. Only meaningful with `sessions`.

```bash
almanac ingest sessions --since 2w          # sessions from last 2 weeks
almanac ingest sessions --tool codex --since 30d
```

Accepts: `Nd` (days), `Nw` (weeks), `Nh` (hours).

### Flag: `--id <session-id>`

Targets one specific session by ID.

```bash
almanac ingest sessions --id abc123-def456
```

### Flag: `--fast` / `--deep`

Controls depth. Orthogonal to source — composes with anything.


| Depth       | What it means                                                    | Cost indicator |
| ----------- | ---------------------------------------------------------------- | -------------- |
| `--fast`    | Skim inputs, extract only explicit decisions/gotchas             | $              |
| *(default)* | Full writer + reviewer pipeline                                  | $$             |
| `--deep`    | Thorough analysis, cross-reference across sources, find patterns | $$$            |


```bash
almanac ingest . --fast                     # quick repo scan
almanac ingest sessions --deep              # thorough session analysis
almanac ingest . sessions --deep            # everything, thorough
```

### Flag: `--force`

Overwrite existing pages. Default behavior is augment (check what exists, only add/update).

### Flag: `--yes`

Skip confirmation prompts. Implied when `!process.stdin.isTTY` (agent/script invocation).

### Flag: `--quiet`

Suppress streaming output. Show only the final summary line.

### Flag: `--model <name>`

Override the agent model. Default: `claude-sonnet-4-6`.

---

## How the agent gets its instructions

No hardcoded preprocessing. No regex strippers. The agent reads a **processing guide** at runtime that teaches it how to handle the specific input format.

### Guide files

Shipped with the npm package in `guides/processing/`:

```
guides/processing/
  claude-code.md     # how to read Claude Code JSONL transcripts
  codex.md           # how to read Codex JSONL transcripts
  cursor.md          # how to read Cursor's SQLite blob store
  aider.md           # how to read Aider's markdown logs
  generic.md         # fallback for unknown formats
```

Each guide is ~80-150 lines of instructions written for an LLM to read. Contains:

- Format overview (what the files look like, where fields are)
- What's signal (human messages, reasoning, decisions, errors)
- What's noise (tool result bodies that dump file contents — already in the repo)
- What to summarize (repetitive tool sequences)
- Extraction examples (sanitized real examples showing "this line → this knowledge")
- Gotchas (things that look like signal but aren't, or vice versa)

### How guides are loaded

```
almanac ingest sessions --tool codex
    ↓
1. CLI resolves: tool = codex
2. CLI loads: guides/processing/codex.md
3. CLI builds the agent's system prompt:
   
   "You are the codealmanac research agent. Your job is to extract
    knowledge from session transcripts.
    
    ## Processing guide
    <contents of guides/processing/codex.md>
    
    ## Existing wiki state
    <output of: almanac search --json --limit 100>
    <output of: almanac topics --json>
    
    ## Your task
    Read the session files provided. Extract knowledge atoms.
    Follow the processing guide for what to keep, skip, and summarize."

4. Agent receives session file paths as its prompt:
   "Process these sessions:
    - ~/.codex/sessions/2026/04/15/rollout-...jsonl
    - ~/.codex/sessions/2026/04/14/rollout-...jsonl"

5. Agent reads each file using the Read tool, following the guide's instructions
6. Agent outputs structured knowledge atoms
```

### For paths (not sessions)

When the source is a file or directory, no tool-specific guide is needed. The agent reads the file and applies the generic extraction approach:

```
almanac ingest docs/plans/proposal.md
    ↓
1. CLI detects: source is a file path
2. CLI loads: guides/processing/generic.md
3. Agent reads the file, extracts knowledge per the generic guide
```

For `.` (current directory = repo exploration):

```
almanac ingest .
    ↓
1. CLI detects: source is "." (the repo root)
2. CLI loads: guides/processing/generic.md (or a repo-specific section within it)
3. Agent explores: package.json, configs, README, source structure
4. Agent decides what entity pages to create based on what it finds
```

The agent handles the difference between "this is a folder of design docs" and "this is a repo root" based on content, not based on a separate `--repo` flag. Intelligence in the agent, not in the CLI.

### For mixed sources

```
almanac ingest . sessions --tool claude --deep
    ↓
1. CLI detects: two sources — "." (path) and "sessions" (keyword)
2. CLI loads: guides/processing/claude-code.md + guides/processing/generic.md
3. System prompt includes BOTH guides
4. Agent receives:
   - "Explore the repo at /path/to/repo" (for the "." source)
   - "Process these Claude sessions: <paths>" (for the sessions source)
5. Agent handles both, cross-referencing where relevant
```

---

## The two-phase pipeline

### Phase 1: Research (parallel, per-source-chunk)

**What:** Extract "knowledge atoms" from raw input.

**Who:** Research subagent(s). One per session or per batch of sessions. For paths, one per file or directory.

**Input:** Raw session file(s) or document(s) + the processing guide.

**Output:** Structured knowledge atoms:

```json
{
  "source": "codex-session-abc123",
  "timestamp": "2026-04-15T10:00:00Z",
  "findings": [
    {
      "type": "decision",
      "summary": "Chose Pydantic AI over LangChain for agent orchestration",
      "reasoning": "Pydantic AI's streaming helper integrates with...",
      "files": ["src/agents/orchestrator.ts"],
      "related_entities": ["pydantic-ai", "langchain"],
      "confidence": "high"
    }
  ]
}
```

**Why atoms, not pages:** Research agents don't write wiki pages directly. They extract structured findings. This lets the synthesis agent see ALL findings across all sources before deciding what pages to create/update — avoiding duplicates.

**Parallelism:** Multiple research agents can run simultaneously on different sessions. Each reads one session + its processing guide. No coordination needed — atoms are independent.

### Phase 2: Synthesis (single agent)

**What:** Read all knowledge atoms + existing wiki → decide what pages to write/update.

**Who:** The writer agent (same one used in current capture). Has the reviewer as a subagent.

**Input:** All knowledge atoms from phase 1 + existing wiki state (via `almanac search/show`).

**Output:** Wiki pages written to `.almanac/pages/`.

**Why single:** One agent sees the full picture. No cross-agent dedup needed. If session 14 and session 27 both discovered the same gotcha, the synthesis agent merges them into one page.

**Reviewer:** Same role as current capture — checks quality, duplicates, missing links, cohesion.

### When phase 1 is skipped

For simple cases (one session, one file), there's no need for a separate research phase. The writer agent reads the source directly and writes pages. Phase 1 exists for batch/multi-source ingestion where cross-source dedup matters.

The CLI decides: if sources × depth implies > ~$0.50 of processing, use the two-phase pipeline. Otherwise, single-agent direct.

---

## Cost estimation + confirmation

Before expensive operations, the CLI estimates cost and confirms:

```
$ almanac ingest sessions --tool codex --since 30d

Found 23 Codex sessions for this repo (last 30 days).
Estimated cost: ~$1.15 ($$, default depth)
Continue? [Y/n]
```

Cost estimation: count sessions × average cost per session at the selected depth.

`--yes` or `!isTTY` skips the prompt.

`--fast` and `--deep` affect the estimate:

```
$ almanac ingest sessions --deep

Found 23 sessions. Estimated cost: ~$3.40 ($$$, deep).
Continue? [Y/n]
```

---

## What the hook fires

The SessionEnd hook runs:

```bash
almanac ingest --yes --quiet
```

Bare invocation. Auto-detects the latest session transcript for the tool that just ended. Processes it with default depth ($$). No confirmation prompt (--yes). No streaming output (--quiet). Results land in `.almanac/pages/` as git diffs.

The hook script passes the transcript path explicitly when available:

```bash
almanac ingest "$TRANSCRIPT_PATH" --yes --quiet
```

---

## Backward compatibility

Old commands become hidden aliases:

```
almanac bootstrap    →  almanac ingest .
almanac capture      →  almanac ingest
almanac capture <f>  →  almanac ingest <f>
```

Not advertised in `--help`. Work indefinitely for scripts/hooks that reference them.

---

## Examples — full walkthrough

### First-time setup (new repo, no wiki)

```bash
npx codealmanac                              # install + setup wizard
cd ~/code/my-project
almanac ingest .                             # scan the repo, create entity stubs
# Agent explores package.json, docker-compose, README, source dirs
# Creates .almanac/pages/nextjs.md, supabase.md, stripe.md, etc.
# Creates .almanac/topics.yaml
# Creates .almanac/README.md with notability bar
```

### Backfill from 3 months of Codex sessions

```bash
almanac ingest sessions --tool codex --since 90d
# Found 47 sessions. Estimated cost: ~$2.35 ($$). Continue? [Y/n]
# y
# Phase 1: 47 research agents process sessions in parallel
# Phase 2: synthesis agent reads all atoms + existing wiki
# Result: 12 pages created, 8 updated, cost: $2.18
```

### Daily automatic capture (invisible)

```
User ends Claude Code session
    ↓
SessionEnd hook fires
    ↓
almanac ingest --yes --quiet
    ↓
Auto-detects latest Claude session transcript
    ↓
Writer processes, reviewer critiques
    ↓
.almanac/pages/stripe-webhook-deadlock.md created
    ↓
Next morning: git status shows the new page
```

### Ingest a ChatGPT export

```bash
almanac ingest ~/Downloads/conversations.json
# Agent reads the file, detects ChatGPT export format
# Loads guides/processing/generic.md (or a ChatGPT-specific guide if we ship one)
# Extracts decisions and knowledge from the conversations
# Writes pages
```

### Full onboarding — everything at once

```bash
almanac ingest . sessions docs/plans/ --deep
# Sources: repo scan + all sessions from all tools + design docs folder
# Deep mode: thorough, cross-referencing across all sources
# Estimated cost: ~$8.50 ($$$). Continue? [Y/n]
# Phase 1: parallel research on each source
# Phase 2: synthesis with full cross-referencing
# Result: 30 pages, comprehensive wiki from scratch
```

---

## Guide files — what they contain

Each guide in `guides/processing/<tool>.md` teaches the agent how to process that tool's output. Example structure:

```markdown
# Processing Codex Sessions

## Format
JSONL at ~/.codex/sessions/YYYY/MM/DD/rollout-<timestamp>-<uuid>.jsonl.
One JSON object per line. Key record types: session_meta, response_item.

## Signal (keep)
- response_item with payload.role = "user": human's intent and questions
- response_item with payload.role = "assistant": AI's reasoning and decisions
- response_item with payload.type = "reasoning": chain-of-thought (use summary field; encrypted_content is unreadable)
- Error messages in exec_command outputs

## Noise (skip)
- function_call_output bodies: these dump file contents already in the repo. Keep the tool name and a one-line summary of what was read, skip the body.
- Large exec_command outputs (build logs, test output): summarize as "ran tests, 47 passed"

## Extraction approach
1. Read the JSONL line by line
2. For user messages: extract the intent ("what are they trying to do?")
3. For assistant messages: extract decisions ("what was chosen and why?")
4. For errors + recovery: extract gotchas ("what went wrong, what was the fix?")
5. Skip consecutive tool-call sequences; summarize as "read N files in src/auth/"

## Example
(sanitized example showing a real signal extraction)
```

The agent reads this guide BEFORE reading the session files. It's runtime instruction, not build-time code.

---

## What's NOT in this design

- **Hardcoded preprocessors.** No regex stripping, no format-specific code parsers. The agent reads the guide and handles the format.
- **Per-tool adapter code.** The only tool-specific code is the SESSION FINDER — the code that knows WHERE each tool stores sessions on disk. The processing itself is guide-driven.
- **A separate `--repo` flag.** `.` is just a path. The agent figures out "this is a repo root" from content.
- **Separate `bootstrap` / `capture` commands.** They become hidden aliases for `ingest .` and `ingest` respectively.

