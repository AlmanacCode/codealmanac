# Processing Codex Sessions

## Format overview

Codex stores sessions as JSONL files at:
```
~/.codex/sessions/<year>/<month>/<day>/rollout-<timestamp>-<thread-uuid>.jsonl
```

A SQLite database at `~/.codex/state_5.sqlite` provides session metadata (title, cwd, model, tokens_used, git info) in the `threads` table.

Multiple rollout files for the same timestamp indicate subagent threads spawned by the parent session. The SQLite `source` column reveals this: `"vscode"` for top-level sessions, a JSON blob with `subagent.thread_spawn.parent_thread_id` for child threads.

Typical session sizes: 500KB (short task) to 12MB+ (multi-turn debugging session). Line counts range from ~175 to ~2,800.

## Record types

Each line is a JSON object with a `type` field:

| Type | % of records | % of bytes | What it contains |
|------|-------------|------------|-----------------|
| `response_item` | ~55% | ~36% | Model outputs: function calls, function call outputs, messages, reasoning |
| `event_msg` | ~43% | ~29% | Harness events: command execution results, token counts, agent messages, task lifecycle |
| `turn_context` | ~2% | ~5% | Per-turn context: model, cwd, instructions, settings. Repeated every turn |
| `session_meta` | 1 per file | ~1-3% | Session metadata: id, cwd, model, CLI version, base instructions, skills |
| `compacted` | rare (0-3) | 10-30% when present | Compressed conversation history from context window compaction |

### response_item subtypes (in `payload.type`)

| Subtype | What it contains |
|---------|-----------------|
| `function_call` | Tool invocations: `name` (always `exec_command`), `arguments` (JSON with cmd, workdir, yield_time_ms) |
| `function_call_output` | Tool results: `output` (command stdout/stderr as string) |
| `message` | Conversation messages. Check `payload.role`: `developer` (system prompts), `user` (human + context), `assistant` (model output) |
| `reasoning` | Model reasoning. Contains `encrypted_content` (unreadable) and `summary` (always empty in observed data) |
| `custom_tool_call` | File edit operations via `apply_patch`. Contains unified diff in `input` |
| `custom_tool_call_output` | Patch application results: success/failure + modified file list |
| `web_search_call` | Web search invocations (rare) |

### event_msg subtypes (in `payload.type`)

| Subtype | What it contains |
|---------|-----------------|
| `user_message` | Human input: `message` (text), `images` (base64 data URIs), `text_elements` |
| `agent_message` | Model commentary shown to user: `message`, `phase` (always "commentary") |
| `exec_command_end` | Command execution results (DUPLICATES `function_call_output`): stdout, stderr, aggregated_output, exit_code, duration, command |
| `token_count` | Token usage and rate limit info per turn |
| `task_started` | Turn lifecycle: turn_id, model_context_window, collaboration_mode |
| `task_complete` | Turn completion: `last_agent_message` (the final text shown to user) |
| `patch_apply_end` | File edit results: stdout, changes list, success boolean |
| `context_compacted` | Marker that context window was compacted |
| `turn_aborted` | Turn was cancelled |

## What to extract (signal)

### 1. Human messages (highest signal density)
- **Where:** `event_msg` records with `payload.type == "user_message"`
- **Field:** `payload.message`
- **Also in:** `response_item` with `payload.type == "message"` and `payload.role == "user"`, `payload.content[].type == "input_text"`. The event_msg version is cleaner
- **Watch for:** The `response_item` version also contains system/developer context injected alongside the real user message. Extract only `input_text` items where the text is NOT wrapped in XML tags like `<environment_context>`, `<permissions instructions>`, `<app-context>`, `<skills_instructions>`, `<collaboration_mode>`

### 2. Agent messages (model's user-facing commentary)
- **Where:** `event_msg` records with `payload.type == "agent_message"`
- **Fields:** `payload.message`, `payload.phase`
- **What:** Short status updates and reasoning the model shares with the user. These are the "thinking out loud" moments
- **Example:** "I'm inspecting the repo for category vs topic naming drift and I'll trace it through code, routes, API shapes, and copy so the discrepancies are concrete rather than guessed."

### 3. Task completion summaries
- **Where:** `event_msg` records with `payload.type == "task_complete"`
- **Field:** `payload.last_agent_message`
- **What:** The final, complete response for each turn. Often the densest signal -- the model's synthesized answer after all tool use. Can be multi-thousand characters of analysis

### 4. Assistant output text
- **Where:** `response_item` with `payload.type == "message"`, `payload.role == "assistant"`, content items with `type: "output_text"`
- **What:** Model's text responses interspersed with tool calls. Shorter than task_complete but captures incremental reasoning

### 5. File edits (apply_patch)
- **Where:** `response_item` with `payload.type == "custom_tool_call"` and `payload.name == "apply_patch"`
- **Field:** `payload.input` contains a unified diff
- **What:** Every code change the model made. Extract the file path and a summary of the change, not the full diff (the repo has the final state)

### 6. Session metadata
- **Where:** `session_meta` record (first line of file)
- **Key fields:** `payload.id`, `payload.cwd`, `payload.model_provider`, `payload.cli_version`, `payload.source`, `payload.model` (in turn_context)
- **SQLite enrichment:** Query `threads` table for `title`, `tokens_used`, `git_branch`, `first_user_message`, `source` (reveals if this is a subagent)

## What to skip (noise)

### 1. function_call_output records (~17% of bytes) -- SKIP
- **Where:** `response_item` with `payload.type == "function_call_output"`
- **Why:** Raw command output (file contents, grep results, build output). Already in the repo or transient

### 2. exec_command_end records (~15% of bytes) -- SKIP
- **Where:** `event_msg` with `payload.type == "exec_command_end"`
- **Why:** DUPLICATES `function_call_output` with the same `call_id`. Contains stdout, stderr, aggregated_output redundantly. In one 12MB session, 399 of these consumed 1.9MB
- **Note:** 100% overlap with function_call_output on shared call_ids

### 3. Reasoning records (~6% of bytes) -- SKIP
- **Where:** `response_item` with `payload.type == "reasoning"`
- **Why:** Contains `encrypted_content` (base64 blob, unreadable) and `summary` (consistently empty array in all observed sessions). No extractable signal
- **Do not confuse with:** `agent_message` records, which ARE readable model reasoning

### 4. turn_context records (~5-25% of bytes) -- SKIP
- **Where:** `type: "turn_context"`
- **Why:** Repeated every turn. Contains model name, cwd, instructions, sandbox policy, collaboration mode. Same content each time with minor variations

### 5. session_meta base_instructions (~3% of bytes) -- SKIP
- **Where:** `session_meta` record, `payload.base_instructions.text`
- **Why:** Codex's built-in system prompt. Same across all sessions. ~2000 chars of personality and behavior instructions

### 6. Developer instructions in message records -- SKIP
- **Where:** `response_item` messages with `payload.role == "developer"`
- **Contains:** `<permissions instructions>`, `<app-context>`, `<collaboration_mode>`, `<apps_instructions>`, `<skills_instructions>` XML blocks
- **Why:** Harness configuration, not user knowledge. Can be 10KB+ per occurrence

### 7. token_count records (~2%) -- SKIP
- Rate limit and token usage telemetry

### 8. function_call records (~1.5%) -- SKIP or SUMMARIZE
- **Where:** `response_item` with `payload.type == "function_call"`
- **Contains:** `name` (always `exec_command`), `arguments` (cmd, workdir)
- **Why:** Operational commands. Summarize the pattern, not individual calls

### 9. Base64 images in user_message (~4-7% when present) -- SKIP
- **Where:** `event_msg` with `payload.type == "user_message"`, `payload.images[]`
- **Format:** data URIs (`data:image/png;base64,...`), 350KB-550KB each
- **Also in:** `response_item` message content with `type: "input_image"` and `image_url`
- **Why:** Screenshots. Not extractable as text knowledge. A single image can be 550KB

### 10. Compacted records (10-30% when present) -- EXTRACT SELECTIVELY
- **Where:** `type: "compacted"` records
- **Contains:** `payload.replacement_history[]` -- a compressed version of earlier conversation
- **Treatment:** These contain summarized versions of earlier turns after context compaction. The `replacement_history` items have `role` and `content[]` with `input_text`/`output_text`. Extract output_text items (model summaries) but skip input_text (already captured from the original records earlier in the file)

## What to summarize

| Pattern | Summarize as |
|---------|-------------|
| N consecutive exec_command function_call/output pairs | "Ran N commands exploring {pattern}" |
| grep/find/sed sequences reading files | "Searched for {pattern} in {directory}" |
| apply_patch calls | "Modified {file}: {one-line description from diff}" |
| Multiple agent_message records saying similar things | Keep only the last one before task_complete |

## Extraction approach

1. **Check SQLite first** for session metadata: `SELECT id, title, cwd, model, tokens_used, git_branch, source, first_user_message FROM threads WHERE id = '<thread-id>'`. The `source` field tells you if this is a subagent session.

2. **Parse the JSONL file** line by line.

3. **Extract session_meta** (first record): grab `payload.id`, `payload.cwd`, `payload.source`, `payload.model_provider`.

4. **For each record, route by type and subtype:**
   - `event_msg` + `user_message` -> **extract** `payload.message` as human input. Note `payload.images` count but skip the base64 data
   - `event_msg` + `agent_message` -> **extract** `payload.message` as model reasoning
   - `event_msg` + `task_complete` -> **extract** `payload.last_agent_message` as turn summary
   - `event_msg` + `exec_command_end` -> **skip** (duplicated in response_item)
   - `event_msg` + `token_count` / `task_started` / `context_compacted` -> **skip**
   - `response_item` + `message` + `role: "assistant"` -> **extract** output_text content
   - `response_item` + `message` + `role: "developer"` or `role: "user"` with XML-tagged content -> **skip**
   - `response_item` + `message` + `role: "user"` with plain text -> **extract** (but deduplicate against event_msg user_message)
   - `response_item` + `function_call_output` -> **skip**
   - `response_item` + `function_call` -> **summarize** command pattern
   - `response_item` + `reasoning` -> **skip** (encrypted, empty summary)
   - `response_item` + `custom_tool_call` -> **summarize** file path and change description
   - `response_item` + `custom_tool_call_output` -> **skip** (just success/fail)
   - `turn_context` -> **skip**
   - `compacted` -> **extract** output_text from `payload.replacement_history[]`

5. **Deduplicate across record types:** User messages appear in both `event_msg.user_message` AND `response_item.message` (role: user). Command output appears in both `response_item.function_call_output` AND `event_msg.exec_command_end`. Always prefer the event_msg version for user messages (cleaner), skip the duplicate command output entirely.

6. **Link subagent sessions:** Check the SQLite `source` column. If it contains `subagent.thread_spawn`, this session's knowledge should be attributed to the parent thread. The `parent_thread_id` field links them.

## Example: signal extraction from a real session

**Human intent (from event_msg.user_message):**
> "Look at our codebase, we have categories and topics, we want to unify everywhere to be called topics. Find all discrepancies."
Signal: User wants a category-to-topic naming audit.

**Agent reasoning (from event_msg.agent_message):**
> "I've isolated one concrete runtime mismatch already: the page-topic footer still talks about 'categories' in UI copy while the rest of the product model is 'topics.' I'm now separating first-party mismatches from external-source fields and old design docs so the final list is usable."
Signal: Agent's approach to categorizing the findings.

**Task completion (from event_msg.task_complete):**
> "Root Cause: This is not primarily a CSS-specificity problem. The break happens because the suggestion extension's renderHTML() emits bare <ins>/<del> tags without the CSS class..."
Signal: Complete diagnosis with root cause and fix path.

**File edit (from custom_tool_call):**
> name: apply_patch, file: SuggestionChangesExtension.ts
> Change: Added class attribute to renderHTML() output so CSS selectors match
Signal: What was actually changed and why.

**Noise skipped:** 442 function_call_output records (2.2MB), 399 duplicate exec_command_end records (1.9MB), 266 encrypted reasoning records (787KB), 67 repeated turn_context records (675KB), 368 token_count records (267KB).

## Gotchas

1. **exec_command_end duplicates function_call_output.** They share the same `call_id` and contain the same command output in different field names. 100% overlap observed. Skip exec_command_end entirely.

2. **Reasoning is unreadable.** Despite having `summary` and `content` fields, reasoning records contain only `encrypted_content` (opaque base64) and consistently empty `summary: []`. There is zero extractable signal from reasoning records.

3. **User messages appear twice.** Once in `event_msg.user_message` (clean, just the text + images) and again in `response_item.message` with `role: "user"` (mixed with system context). Use the event_msg version.

4. **Developer messages are system prompts, not human.** `response_item.message` with `role: "developer"` contains harness instructions (permissions, app context, collaboration mode, skills). These are NOT human messages. They are wrapped in XML tags like `<permissions instructions>`, `<app-context>`, etc.

5. **Images are massive.** User messages with screenshots contain base64 data URIs of 350-550KB each. A single image can make a 75-char message record balloon to 550KB. Check `payload.images` length but do not extract the base64 data.

6. **Compacted records contain earlier conversation.** When the context window fills up, Codex compacts history into `compacted` records. The `replacement_history` array contains summarized earlier turns. If you are processing the file start-to-finish, you will see the original records first and then the compacted summary later -- be careful not to double-count.

7. **Subagent sessions are separate files.** A parent session spawns subagent threads that are written to their own rollout files in the same date directory. The SQLite `source` column JSON identifies child threads. To get the complete picture of a multi-agent session, you must read all linked rollout files.

8. **Codex uses `exec_command` for everything.** Unlike Claude Code which has specialized tools (Read, Grep, Edit, Bash), Codex wraps all operations in `exec_command` with shell commands (`sed`, `rg`, `cat`, etc.) or `apply_patch` for file edits. This means function_call records are less informative about intent -- you need to parse the `cmd` field to understand what was done.

9. **task_complete contains the cleanest signal.** The `last_agent_message` in task_complete records is the final synthesized response after all tool use. If you can only extract one thing per turn, extract this.

10. **The model field is in turn_context, not session_meta.** Session_meta has `model_provider` ("openai") but the actual model name (e.g., "gpt-5.4") is in `turn_context.model`.
