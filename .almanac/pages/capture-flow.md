---
title: Capture Flow
summary: "`almanac capture` resolves transcript inputs and runs the Absorb operation, while `capture sweep` adds scheduled quiet-transcript discovery for Claude and Codex."
topics: [agents, flows]
files:
  - src/commands/operations.ts
  - src/cli/register-wiki-lifecycle-commands.ts
  - src/commands/session-transcripts.ts
  - src/operations/absorb.ts
  - prompts/operations/absorb.md
  - src/commands/capture-sweep.ts
  - src/commands/automation.ts
sources:
  - /Users/kushagrachitkara/.codex/sessions/2026/05/11/rollout-2026-05-11T14-32-08-019e18f4-5e73-7790-ba49-73cc02544a58.jsonl
  - /Users/kushagrachitkara/.codex/sessions/2026/05/11/rollout-2026-05-11T21-33-50-019e1a76-701d-7583-a76c-b3739632ee9b.jsonl
  - https://openai.com/api/pricing/
  - https://developers.openai.com/api/docs/models/gpt-5.5
verified: 2026-05-12
---

# Capture Flow

`almanac capture` is the session-ingest command for the V1 Absorb operation. It resolves one or more coding-session transcript files, builds command context, and calls [[wiki-lifecycle-operations]] with `targetKind: "session"`. The operation then runs through [[process-manager-runs]] and [[harness-providers]] like every other AI write path.

The old hardcoded writer/reviewer capture pipeline was removed. There is no `prompts/writer.md`, `prompts/reviewer.md`, `src/commands/capture.ts`, `src/agent/sdk.ts`, or capture-specific `StreamingFormatter` in V1. Old root-level `.capture-*.log` provider logs were replaced by [[process-manager-runs]] JSON/JSONL records.

## Transcript inputs are raw evidence

Capture should treat session transcripts as raw evidence, not as trustworthy summaries or wiki-ready prose. A 2026-05-11 Codex capture discussion included a long accidental tool-output dump from another repo's config and test run, including sensitive-looking values mixed with otherwise irrelevant debugging output. The durable lesson is broader than that one incident: transcript files can contain large raw command output, noisy detours, and accidental data exposure.

For Absorb, that means the unit of value is the conclusion the agent can verify from the transcript, not the transcript text itself. Durable implementation or product understanding may still belong in the wiki, but raw blobs, copied secrets, and incidental debug output do not. This matches the prompt doctrine that inputs are raw material rather than outputs.

The same lesson shapes transcript discovery tooling, not just wiki prose. The scheduled sweep's metadata pass only reads an initial header chunk and first lines to recover fields such as session id and cwd, instead of eagerly loading whole transcript files during candidate discovery. That keeps the cheap path cheap, but it also limits how much noisy or sensitive transcript content routine automation touches before a session is even eligible for capture.

Later turns in the same 2026-05-11 session pushed this one step further for actual Absorb work: large JSONL transcripts should be treated as structured event streams, not as text blobs to read linearly into context. The durable recommendation was to extract the useful capture signal structurally:

- user asks and clarifications
- assistant decisions and final answers
- commands run plus short outcomes
- touched files
- explicit errors, fixes, and durable implementation notes

Repeated JSON envelopes, long tool schemas, verbose stdout, and other raw payloads may dominate transcript size without adding wiki value. The rough estimate from the session was that a very large first-run corpus can shrink dramatically once reduced to capture-relevant signal. That is a cost-model conclusion, not a claim that current code already performs this reduction.

The same transcript also exposed a concrete Codex-specific version of that noise pattern: naive text search can get swamped by the opening `session_meta` payload, repeated `turn_context` blocks, and serialized tool catalogs before it reaches the user/problem signal. Future transcript tooling should therefore prefer event-type-aware extraction over generic line-oriented grep whenever it is trying to recover capture-relevant meaning rather than debug the transcript format itself.

A later Codex subagent experiment sharpened that cost-model warning with real usage data. A helper agent was asked to read and summarize a `716,942`-byte / `414`-line session transcript whose naive `chars / 4` estimate was about `179k` tokens. The helper's own Codex transcript finished at `315,173` cumulative `total_tokens`, with `260,992` of those counted as cached input. The durable lesson is that transcript size is not a reliable proxy for actual capture cost once the agent takes multiple turns, carries tool output forward, and benefits from cache reuse. Future optimization work should benchmark candidate capture strategies against real transcript `token_count` logs rather than assuming file-size heuristics are good enough.

The same experiment also showed why any future "estimate capture cost" feature needs a model-aware pricing rule, not just token totals. Using OpenAI's published 2026-05-12 GPT-5.5 standard rates, the run's `311,995` input tokens and `3,178` output tokens translate to a simple base-rate estimate of about `$0.48` when cached-input discounts are applied, or about `$1.66` if none of the input had been cached. But GPT-5.5's own model page also states that prompts above `272K` input tokens are billed at higher full-session rates. The durable conclusion is not the exact dollar figure from this one transcript; it is that transcript benchmarks must preserve raw token counts, cached-vs-uncached breakdown, and the pricing rule version used for the estimate.

The same experiment also exposed one archival parsing wrinkle worth preserving: raw Codex session transcripts may contain `token_count` events whose `info` payload is `null` before later events settle into the expected `last_token_usage` / `total_token_usage` shape. Any offline transcript-analysis or benchmarking helper should therefore treat `token_count` as a best-effort structured stream and skip unusable entries defensively instead of assuming every event can be parsed into usage numbers.

The same transcript family also carries another durable signal inside `token_count`: Codex logs `rate_limits` metadata alongside usage totals. The observed shape includes `primary` and `secondary` windows with `used_percent`, `window_minutes`, and `resets_at`, plus plan metadata such as `plan_type`. In the 2026-05-11/2026-05-12 capture-cost investigation, the same transcript stream showed `primary.window_minutes = 300` and `secondary.window_minutes = 10080`, which strongly suggests a short-window and long-window usage view rather than a second token counter. Importantly, `rate_limits` can still be present on early `token_count` events even when `info` is `null`, so offline parsers should treat token totals and limit telemetry as related but independently optional substructures.

The same investigation later added a more useful backlog-planning calibration by measuring a batch of ten helper-agent transcript reads instead of a single case. Across `36.95 MB` of source JSONL (`12,734` lines), the helper transcripts accumulated `2,790,928` total tokens, with `2,238,976` counted as cached input and `522,314` as uncached input. The visible Codex subscription telemetry moved from roughly `8% / 2%` (`primary` / `secondary`) before the sample to about `10% / 3%` during the second batch, with a later `11% / 3%` reading that also included some main-thread work. The durable conclusion is not the exact percentage from one day on one plan; it is that real capture-cost benchmarks should preserve three distinct signals together:

- source transcript size and line count
- token totals, including cached-vs-uncached input
- rate-limit telemetry snapshots before and after a batch

The same measurement also showed one subtle interpretation trap: first and last `used_percent` values inside an individual helper transcript can stay flat at `0` delta even when the overall account usage clearly rose across the full batch. That means any future estimator or benchmarking script should not rely only on per-transcript start/end percentages; it should also compare batch-boundary or account-level readings when interpreting subscription impact.

## Command surface

The public command is `almanac capture [sessionFiles...]`, with alias `almanac c`.

The currently wired flags are:

- `--app <app>`
- `--session <id>`
- `--since <duration-or-date>`
- `--limit <n>`
- `--all`
- `--all-apps`
- `--using <provider[/model]>`
- `--foreground`
- `--json`
- `-y, --yes`

`almanac capture sweep` is a subcommand, not another transcript-file argument. Its key flags are:

- `--apps <apps>` for `claude`, `codex`, or both
- `--quiet <duration>` with a default of 45m
- `--using <provider[/model]>`
- `--dry-run`
- `--json`

The durable behavioral split is more important than the spelling of each flag:

- transcript files can always be passed explicitly
- discovery mode is still Claude-first today
- background execution is the default, and `--foreground` opts into attached streaming
- `--json` only applies to background start responses, not foreground runs

One implementation gotcha from the 2026-05-11/2026-05-12 sweep smoke tests is easy to miss when extending this command surface: `capture` and `capture sweep` both define `--json`. In Commander, invoking `almanac capture sweep --json` can therefore put the flag on the parent `capture` command rather than the leaf subcommand action args. `register-wiki-lifecycle-commands.ts` now reads `command.optsWithGlobals()` for `capture sweep` and `capture status` so shared or parent-level flags do not disappear at runtime even when help output looks correct.

## Transcript resolution

Resolution lives in `src/commands/session-transcripts.ts` before Absorb starts:

- Explicit transcript file args are validated and passed through.
- No-arg capture defaults to Claude transcript discovery.
- `--session <id>` finds a matching Claude `<id>.jsonl`.
- `--since`, `--limit`, and `--all` filter Claude discovery.
- Codex/Cursor discovery and `--all-apps` still fail clearly unless transcript files are provided.

The important current implementation boundary is that `runCaptureCommand()` resolves a concrete list of transcript file paths first, then passes those absolute paths into `runAbsorbOperation()` as normal session targets. There is no capture-time notion of "read only bytes N-M from this transcript" in today's command surface.

That boundary also matters at prompt-construction time. `captureContext()` in [[src/commands/operations.ts]] does not inline transcript contents into the Absorb prompt or try to pre-truncate the session into the context window. It appends a command-context block listing the resolved session/transcript file paths, then relies on the Absorb agent's normal filesystem/search tools to inspect the transcript lazily in chunks as needed. For large or noisy transcripts, "capture input" therefore means "here are the files to examine," not "here is the whole transcript stuffed into the model context."

The scheduler path extends this resolver boundary rather than replacing it. `capture sweep` discovers candidate transcript files itself, but it still starts normal capture jobs with ordinary transcript paths and additional cursor context.

The first scheduled discovery implementation scans Claude transcripts under `~/.claude/projects/**/*.jsonl` and Codex transcripts under `~/.codex/sessions/**/*.jsonl`. Claude subagent paths are ignored, and Codex transcripts marked with `payload.thread_source === "subagent"` are ignored.

Continuation capture keeps passing the original transcript path into capture, and adds cursor context telling Absorb what transcript prefix was already captured. That preserves the "agent inspects files lazily" contract while avoiding temp delta transcript files or byte-range semantics in `almanac capture`.

One open operational consequence from the same session is that "pass the original transcript path" is still compatible with a smarter first step inside Absorb. Future prompt or tooling work can keep the current command surface while instructing the agent to parse JSONL structurally before reading deeply, and can optionally add a cheap preflight size estimator or cap for unusually large first-run backlogs. Neither behavior is part of the current implementation.

Discovery first tries to match transcripts by directory name hash, which is the fast path with no transcript-content IO. If no matches are found, it falls back to content scanning: each transcript is opened, and `readHead(path, 4096)` checks whether the first 4 KB contains `"cwd":"<repoRoot>"`. One known performance issue remains in that fallback: `readHead` currently calls `readFile()` to load the entire file into memory before slicing. On a Claude projects directory with many large session files this causes hundreds of MB of unnecessary IO at `almanac capture` startup. The fix is to use `fs.open().read()` or a bounded stream limited to 4,096 bytes.

## Sweep dry-run semantics

`almanac capture sweep --dry-run` is a verification path, not a background-start variant. It should discover the same candidates and compute the same cursor ranges as a real sweep, but it must not enqueue capture jobs or create/update [[capture-ledger]] state.

The late 2026-05-11 smoke test found two behavior details worth preserving:

- JSON output for dry-run has to honor the same merged option handling as the live command, or `--json` can silently fall back to human text.
- Human-readable dry-run output should say `would start`, not `started`, because no capture job was actually enqueued.

The current implementation reflects both rules. The focused sweep tests also lock in one more behavioral claim: mixed-app dry-run discovery is real, not theoretical. A real smoke test against the developer's local transcript stores found both Claude and Codex candidates, with Codex sessions contributing substantial eligible work rather than being absent from the discovery set.

## Absorb execution

Capture appends session-file context to `prompts/operations/absorb.md` through [[operation-prompts]]. `src/operations/absorb.ts` requests read, write, edit, search, and shell tools, sets `metadata.operation = "absorb"`, and defaults to background execution unless `--foreground` is passed.

Provider-specific behavior is adapter-owned. Claude may support helper agents through [[harness-providers]], but Capture no longer hardcodes a reviewer subagent or a capture-only SDK wrapper.

## No-op captures

Capture can produce no page changes if the transcript does not meet the notability bar. In V1 the observable record is a completed run with zero created, updated, and archived pages in `.almanac/runs/`.

## Log files

Raw provider events are normalized and written to `.almanac/runs/<run-id>.jsonl`. Run status, target paths, provider/model, PID, summary counts, and errors live in `.almanac/runs/<run-id>.json`.

## Scheduled automation

Automatic capture is scheduler-driven. `almanac automation install` writes a macOS launchd plist that runs `almanac capture sweep` every 5h by default. Sweep applies quiet-window and ledger rules in-process, so launchd is only the wakeup mechanism; it does not own capture state.
