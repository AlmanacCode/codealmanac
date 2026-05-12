# Processing Claude Code Sessions

## Format overview

Claude Code stores sessions as JSONL files (one JSON object per line) at:
```
~/.claude/projects/<project-hash>/<session-uuid>.jsonl
```

The project hash is a path with slashes replaced by dashes (e.g., `-Users-rohan-Desktop-Projects-myrepo`). Each session file contains the full conversation history including tool calls, tool results, thinking blocks, and metadata.

Typical session sizes: 150KB (short Q&A) to 8MB+ (multi-hour coding session). Line counts range from ~75 to ~1,750.

## Record types

Each line is a JSON object with a `type` field at the top level:

| Type | Frequency | What it contains |
|------|-----------|-----------------|
| `assistant` | ~40% of records, ~15% of bytes | Model responses: text, tool_use, thinking blocks. Each content item is in `message.content[]` |
| `user` | ~35% of records, ~55% of bytes | Human messages OR tool results. Check `message.content[].type` to distinguish |
| `attachment` | ~5% of records, ~7% of bytes | System context injected by the harness: deferred tool lists, skill listings, memory, task reminders, edited file snippets |
| `file-history-snapshot` | ~5% of records, <1% of bytes | Checkpoint markers for undo/redo. Always tiny (~250 bytes) |
| `permission-mode` | ~3% of records, <1% of bytes | Records when permission mode changes (e.g., `bypassPermissions`) |
| `last-prompt` | ~3% of records, <1% of bytes | Marks turn boundaries. ~120 bytes each |
| `system` | ~2% of records, <1% of bytes | System messages injected mid-conversation. Often empty content |
| `ai-title` | rare | Auto-generated session title |
| `queue-operation` | rare | Queued follow-up commands |

## What to extract (signal)

### 1. Human messages (highest signal density)
- **Where:** Records with `type: "user"` where `message.content[]` contains items with `type: "text"`
- **Also check:** `userType` field -- `"external"` means the actual human typed this
- **What:** Intent, requirements, feedback, decisions, bug reports, design direction
- **Example pattern:** `{"type": "user", "message": {"content": [{"type": "text", "text": "What problems did you run into?"}]}}`

### 2. Assistant text responses
- **Where:** Records with `type: "assistant"`, then `message.content[]` items with `type: "text"`
- **What:** Explanations, decisions, summaries, architecture analysis, bug diagnoses
- **Typical size:** 100-3000 chars per text block
- **Example pattern:** The assistant explains a root cause, summarizes what was built, or describes a design decision

### 3. Subagent results (high-value signal hidden in noise)
- **Where:** Records with `type: "user"` that have a top-level `toolUseResult` field with `agentType` set
- **What:** Complete results from subagents (review, critic, pair, etc.). The `content` field contains the full subagent output, often multi-thousand-character analysis
- **Key fields:** `toolUseResult.agentType` (e.g., "general-purpose", "review", "critic", "pair"), `toolUseResult.content[].text`, `toolUseResult.prompt` (what the subagent was asked to do)
- **Why it matters:** These are often the densest signal in a session -- complete audit reports, code reviews, architecture analyses

### 4. Session metadata
- **Where:** First few records of the file
- **Key fields on user records:** `cwd`, `gitBranch`, `version`, `timestamp`, `sessionId`, `entrypoint` (cli vs other)
- **Attachment records** with `type: "nested_memory"` contain the project's memory/context

## What to skip (noise)

### 1. Tool results (~24% of total bytes) -- SKIP
- **Where:** `user` records where `message.content[]` has `type: "tool_result"`
- **Why skip:** These are file contents, grep results, build output, test output. The actual files are in the repo; the output is transient
- **The biggest offenders:** Read tool results can be 150KB+ (entire file contents dumped inline)

### 2. Tool calls (~8% of total bytes) -- SKIP or SUMMARIZE
- **Where:** `assistant` records where `message.content[]` has `type: "tool_use"`
- **Contains:** `name` (Bash, Read, Grep, Edit, Write, Glob) and `input` (command, file path, pattern)
- **Why skip:** The sequence of tool calls is operational, not knowledge. Exception: summarize the *pattern* of tool usage ("read 15 files in src/auth/")

### 3. Wrapper overhead (~38% of total bytes in large sessions) -- SKIP
- **Where:** Top-level fields on `user` records: `parentUuid`, `sourceToolAssistantUUID`, `toolUseResult` (when not a subagent), `slug`, `requestId`, `isMeta`, `isSidechain`
- **Why skip:** The `toolUseResult` field on user records DUPLICATES the tool result content that already appears in `message.content[]`. This is the single biggest source of bloat. In one 8MB session, `toolUseResult` alone was 2.7MB (33%)
- **EXCEPTION:** When `toolUseResult.agentType` is set, this is a subagent result and IS signal

### 4. Empty thinking blocks (~6% in some sessions) -- SKIP
- **Where:** `assistant` records, `message.content[]` with `type: "thinking"` but `thinking: ""`
- **Why:** Claude Code often records thinking blocks with empty content (the actual thinking happened but was not persisted). These are pure waste

### 5. Attachments (~7%) -- SKIP
- **Where:** `type: "attachment"` records
- **Contains:** `deferred_tools_delta` (tool availability lists), `skill_listing` (repeated skill menus), `task_reminder` (repeated TODO lists), `mcp_instructions_delta` (MCP setup)
- **Why skip:** Harness infrastructure, not knowledge. Repeated across turns

### 6. Metadata records (<1%) -- SKIP
- `file-history-snapshot`, `permission-mode`, `last-prompt`, `queue-operation`, `ai-title`

### 7. Base64 image data (~1-7% in some sessions) -- SKIP
- **Where:** `user` records with `message.content[]` containing `type: "image"` and `source.type: "base64"`
- **Why skip:** Screenshots pasted by the user. Can be 100KB+ of base64 per image. Not extractable as knowledge

## What to summarize

These patterns should be compressed rather than fully extracted or fully skipped:

| Pattern | Summarize as |
|---------|-------------|
| 10+ consecutive tool_use/tool_result pairs reading files | "Read N files in {directory pattern}" |
| grep/glob sequences searching for a pattern | "Searched for {pattern} across {scope}" |
| Edit tool calls modifying files | "Modified {file}: {description from the Edit input}" |
| Bash commands running tests | "Ran tests: {pass/fail summary from result}" |
| Bash commands running builds | "Built {target}: {success/failure}" |

## Extraction approach

1. **Parse the JSONL file** line by line. Each line is one JSON object.
2. **First pass -- extract metadata:** From the first `user` record, grab `cwd`, `gitBranch`, `version`, `timestamp`, `sessionId`.
3. **For each record, check `type`:**
   - `type: "user"` with `message.content[].type == "text"` -> **extract as human message**
   - `type: "user"` with `toolUseResult.agentType` set -> **extract subagent result** from `toolUseResult.content[].text`
   - `type: "user"` with `message.content[].type == "tool_result"` -> **skip** (or summarize tool call patterns)
   - `type: "assistant"` with `message.content[].type == "text"` -> **extract as assistant reasoning**
   - `type: "assistant"` with `message.content[].type == "thinking"` and non-empty `thinking` field -> **extract as internal reasoning**
   - `type: "assistant"` with `message.content[].type == "tool_use"` -> **skip or summarize**
   - `type: "attachment"`, `type: "system"`, metadata types -> **skip**
4. **Second pass -- deduplicate:** The `toolUseResult` field on user records often duplicates content from `message.content[]`. Always prefer `message.content[]` and only use `toolUseResult` for subagent data.
5. **Third pass -- compress tool sequences:** Collapse consecutive tool_use + tool_result pairs into summaries.

## Example: signal extraction from a real session

**Human intent (from user record):**
> "Tell me about our ref token?"
Signal: User wants to understand the ref token system.

**Assistant reasoning (from assistant text):**
> "Ref Token: Opaque backend-signed token that binds a locally-edited .md file to a specific page in the DB. Backend signs on download, verifies on publish. No signing secret ever touches the client."
Signal: Architectural explanation of the ref token system.

**Assistant problem diagnosis (from assistant text):**
> "Root cause: the Almanac CLI expects topics.yaml in the new list format but .almanac/topics.yaml is still in the old dict format"
Signal: Bug identification with root cause.

**Subagent audit (from toolUseResult with agentType):**
> agentType: "general-purpose", prompt: "You are auditing the hosted editor..."
> content: "Audit Report: Hosted Editor / Quill Co-Editing (Pre-Phase-5) ... 3 HIGH gaps found ... Fix malformed edit-result surfacing ... Fix Quill session isolation ..."
Signal: Complete code audit with findings, priorities, and recommendations.

**Noise skipped:** 522 tool results totaling 2MB of file contents, 466KB of empty thinking blocks, 408KB of metadata records, 2.7MB of duplicated toolUseResult data.

## Gotchas

1. **toolUseResult duplication is massive.** In one 8MB session, `toolUseResult` accounted for 33% of the file. It duplicates `message.content[]` tool results AND sometimes contains subagent results. Always check `agentType` before discarding.

2. **Thinking blocks are always empty in recent versions.** The `thinking` field in content items of type `"thinking"` is consistently empty string in observed sessions (95 empty out of 95 in one session). The thinking content is not persisted. Do not expect signal here despite the promising field name.

3. **assistant records contain message-level metadata.** The `message` object has `usage` (token counts), `model` (model name), `stop_reason` (why generation stopped). These can be useful for understanding session dynamics but are not knowledge signal.

4. **user records serve double duty.** A `user` record with `userType: "external"` and text content is a real human message. A `user` record with tool_result content is just the harness returning tool output. Always check `message.content[].type`.

5. **The `isSidechain` field** indicates branched conversations (user went back and tried a different approach). Sidechain records may represent abandoned approaches -- still potentially valuable as "what was tried and rejected."

6. **Base64 images can be huge.** A single screenshot paste can add 100KB+ of base64 data to a user record. These look like small records until you measure them.

7. **Attachment records repeat.** `skill_listing` and `task_reminder` attachments are re-injected at many turn boundaries. The same content appears 10-15 times in a long session.

8. **Subagent data structure:** The `toolUseResult` for subagents includes `toolStats` (readCount, searchCount, bashCount, editFileCount, linesAdded, linesRemoved) and `usage` (input_tokens, output_tokens, cache stats). These are useful metadata about the subagent's work.
