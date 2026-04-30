# Processing Unknown Session Formats

This guide is a fallback for session files that do not match known formats (Claude Code JSONL, Codex rollout JSONL). Use it when you encounter a new tool or an unrecognized file structure.

## Step 1: Identify the format

Check the file extension and first few lines:

- **JSONL** (`.jsonl`): One JSON object per line. Parse each line independently
- **JSON** (`.json`): Single JSON document. Could be an array of messages or a nested conversation object
- **Markdown** (`.md`): Likely a conversation export with `## Human` / `## Assistant` headers or similar
- **Plain text** (`.txt`, `.log`): Look for turn separators (blank lines, `---`, timestamps)
- **SQLite** (`.sqlite`, `.db`): Database with conversation tables. List tables first, then query

For JSONL, check each line for a `type`, `role`, or `kind` field. The presence of certain fields reveals the format:
- `type: "user"` / `type: "assistant"` + `message.content` -> Claude Code format
- `type: "response_item"` / `type: "event_msg"` -> Codex format
- `role: "user"` / `role: "assistant"` without a wrapper type -> Raw API conversation log
- `type: "human"` / `type: "ai"` -> LangChain/LangSmith format

## Step 2: Classify each record

For any conversation format, records fall into these universal categories:

### Signal (extract)
1. **Human messages** -- What the user asked, decided, or directed. These explain intent, requirements, and constraints. Look for:
   - Records with `role: "user"` or `type: "human"` or `type: "user_message"`
   - Text that reads like natural language instructions, questions, or feedback
   - Short messages (under ~500 chars) are almost always signal

2. **AI reasoning text** -- Explanations, analyses, decisions, and summaries the model produced. Look for:
   - Records with `role: "assistant"` and text content (not tool calls)
   - Fields named `text`, `content`, `message`, `output`, `response`
   - Text that explains *why* something was done, not *what* command was run

3. **Final/summary responses** -- The model's synthesized answer after a chain of tool use. Look for:
   - The last assistant message before the next human message
   - Fields named `final_response`, `last_message`, `summary`, `result`
   - These are typically the densest signal per byte

4. **Error messages and failures** -- What went wrong and why. Look for:
   - Records containing `error`, `failed`, `exception`, `traceback`
   - These often reveal important constraints, gotchas, or architectural issues

### Noise (skip)
1. **File contents returned by tools** -- Already in the repo. Look for:
   - Records with `type: "tool_result"`, `type: "function_call_output"`, or `type: "tool_output"`
   - Content that looks like source code (imports, function definitions, indented blocks)
   - Long strings (>2KB) that are clearly file dumps
   - **Size clue:** If a record is >10KB, it is almost certainly a tool result, not reasoning

2. **Tool invocations** -- What commands were run. Operational, not knowledge. Look for:
   - Records with `type: "tool_use"`, `type: "function_call"`, or `type: "tool_call"`
   - Fields named `name`, `arguments`, `input`, `command`
   - Exception: file edit commands may contain the *what* of a change (summarize those)

3. **System prompts and instructions** -- Same across sessions. Look for:
   - Records with `role: "system"` or `role: "developer"`
   - Content wrapped in XML tags (`<instructions>`, `<context>`, `<rules>`)
   - Long preambles about model behavior, tool availability, permissions

4. **Metadata and telemetry** -- Session infrastructure. Look for:
   - Token counts, usage statistics, rate limits
   - Timestamps, UUIDs, session IDs (useful for linking but not knowledge)
   - Permission changes, mode switches, checkpoint markers

5. **Base64-encoded data** -- Images, files, binary content. Look for:
   - Long strings matching `[A-Za-z0-9+/=]{1000,}` or data URIs
   - Fields named `image`, `data`, `base64`, `source.data`

6. **Duplicate records** -- Many formats log the same event multiple ways. Look for:
   - Records sharing an ID field (`call_id`, `tool_use_id`, `request_id`)
   - The same text appearing in both a streaming record and a final record

### Summarize (compress)
1. **Sequences of tool calls** -- "Read 15 files in src/lib/" is better than 15 individual read records
2. **Repetitive status updates** -- "Still searching..." x10 -> "Searched extensively"
3. **Build/test output** -- "Tests: 58/58 passed" not the full test runner output
4. **File edit details** -- "Modified auth.ts: added token validation" not the full diff

## Step 3: Estimate signal ratio

Before processing the full file, sample it:

1. Take the first 20 records, middle 20, and last 20
2. Classify each as signal / noise / summarize
3. Measure bytes in each category

Typical ratios from known formats:
- **Claude Code:** 3-15% signal, 85-97% noise (tool results + wrapper overhead dominate)
- **Codex:** 10-19% signal, 50-70% noise, 20-30% ambiguous (reasoning encrypted, compacted records)
- **Raw API logs:** 30-50% signal (no tool overhead, just conversation)
- **Chat exports (markdown):** 60-80% signal (already cleaned by the export process)

## Step 4: Extract

For each signal record, extract:
- **Who said it:** human or AI
- **What they said:** the text content
- **When:** timestamp if available
- **Context:** what came before (the preceding human message gives context to an AI response)

Structure the output as a sequence of turns:
```
[timestamp] HUMAN: <message>
[timestamp] AI: <response>
[timestamp] HUMAN: <follow-up>
[timestamp] AI: <response>
```

## Step 5: Handle unknowns gracefully

If you cannot classify a record:
- If it is <1KB, include it (small records are cheap to carry)
- If it is >10KB, skip it (large unclassified records are almost always tool output)
- If it contains natural language prose, include it
- If it contains code, JSON, or structured data, skip it

## Privacy checks

Before outputting extracted content, scan for:
- API keys: patterns like `sk-`, `ghp_`, `Bearer `, `token: "`
- Passwords: fields named `password`, `passwd`, `secret`
- Personal data: email addresses, IP addresses, phone numbers
- File paths: may reveal usernames (e.g., `/Users/johndoe/`)
- JWT tokens: strings matching `eyJ...`

Flag these but do not include them in extracted output.
