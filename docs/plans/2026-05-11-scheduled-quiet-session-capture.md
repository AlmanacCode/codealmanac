# Scheduled quiet-session capture

Date: 2026-05-11

Status: accepted and implemented.

## Why this exists

CodeAlmanac previously relied on app lifecycle hooks for automatic capture.
That looked clean for Claude Code because Claude exposes a real `SessionEnd`
hook, but the model did not generalize across agent apps.

The concrete problem discovered on 2026-05-11:

- Claude has `SessionEnd`, which is a session-lifecycle boundary.
- Codex currently exposes `Stop`, but not a reliable `SessionEnd` hook.
- Codex `Stop` is closer to "agent finished this turn" than "user is done
  with this thread".
- Cursor has its own hook shape and should not define the product contract.

The product should not depend on each agent app agreeing on what "session end"
means. The more durable contract is:

> CodeAlmanac periodically finds coding-session transcripts that are ready to
> capture, then absorbs only the new uncaptured portion of each session.

For the first implementation, "ready" means the scheduled sweep found a session
that is old enough/quiet enough and has new transcript content that has not
already been captured.

## Product behavior

Automatic capture becomes a scheduled background sweep.

Default install:

```text
every: 5h
apps: claude,codex
mode: background capture
```

The interval is configurable by the user. A first version can make the interval
the only required configuration knob and keep deeper eligibility settings as
advanced options.

The scheduled job does not keep a daemon process alive. It asks the operating
system scheduler to run a short CodeAlmanac command at the configured interval.

When automation is first enabled, CodeAlmanac records an activation timestamp in
global config:

```toml
[automation]
capture_since = "2026-05-12T05:10:00.000Z"
```

`capture sweep` ignores transcript files whose mtime predates that timestamp.
This makes scheduled capture forward-looking by default: a new user does not
silently backfill every Claude/Codex session already on their machine.

Conceptually:

```text
macOS launchd wakes up every 5h
  -> runs `almanac capture sweep`
  -> CodeAlmanac scans known transcript stores
  -> eligible sessions start normal background capture jobs
  -> the sweep process exits
```

The sweep may run often or rarely. The expensive agent work only happens when a
session has new eligible content.

## Command surface

Two command groups keep the architecture understandable:

```bash
almanac capture sweep
almanac automation install
almanac automation status
almanac automation uninstall
```

`capture sweep` is the testable core. It can be run manually and by the
scheduler.

Proposed options:

```bash
almanac capture sweep
almanac capture sweep --apps claude,codex
almanac capture sweep --quiet 45m
almanac capture sweep --dry-run
almanac capture sweep --json
```

`automation install` owns scheduler registration.

Proposed options:

```bash
almanac automation install
almanac automation install --every 5h
almanac automation install --every 30m
almanac automation status
almanac automation uninstall
```

Default `--every` should be `5h`.

Open naming question: `automation` may be too broad. Alternatives:

- `almanac scheduler install`
- `almanac auto-capture install`
- `almanac capture schedule install`

The important implementation boundary is not the name: scheduler commands
should only install/status/uninstall the OS scheduled task. Sweep logic belongs
in `capture sweep`.

## Scheduler architecture

The scheduler is platform-specific plumbing around the same CLI command.

### macOS

Use a user-level `launchd` LaunchAgent:

```text
~/Library/LaunchAgents/com.codealmanac.capture-sweep.plist
```

The plist runs:

```bash
almanac capture sweep
```

with:

```text
StartInterval = 18000
```

for the default 5-hour interval.

CodeAlmanac should also configure stdout/stderr logs somewhere predictable,
for example:

```text
~/.codealmanac/logs/capture-sweep.out.log
~/.codealmanac/logs/capture-sweep.err.log
```

or under the existing global config/state directory if the project already has
one.

### Linux

Future: systemd user timer first, cron fallback if systemd user services are
not available.

### Windows

Future: Task Scheduler.

### Why not a daemon

A daemon would need process supervision, update handling, crash behavior,
logs, and a long-running Node/runtime story. A scheduled CLI invocation keeps
the first version simple:

- no long-running CodeAlmanac process
- no internal sleep loop
- scheduler survives terminal/app exits
- manual and automatic behavior are the same command

## Sweep architecture

`almanac capture sweep` is a deterministic local scanner.

High-level flow:

```text
1. Load global/user automation config.
2. Discover transcript candidates for enabled apps.
3. Normalize candidates into one internal shape.
4. Map each candidate to a repo containing `.almanac/`.
5. Load that repo's capture ledger.
6. Decide whether the candidate has uncaptured content.
7. Start normal background capture for eligible transcripts, passing cursor
   guidance that tells the agent where new content begins.
8. Record queued/captured state in the ledger.
9. Print a concise summary.
```

Normalized candidate shape:

```ts
interface SessionCandidate {
  app: "claude" | "codex";
  sessionId: string;
  transcriptPath: string;
  cwd?: string;
  repoRoot?: string;
  mtimeMs: number;
  sizeBytes: number;
}
```

The first version should support Claude and Codex only. Cursor transcript
detection is explicitly out of scope for this build and can be added later as a
third discovery adapter.

## Discovery adapters

Each app gets a small discovery adapter:

```text
src/capture/discovery/claude.ts
src/capture/discovery/codex.ts
```

Each adapter returns `SessionCandidate[]`. It should not start capture and
should not read entire transcripts unless needed for repo mapping.

### Claude

Known store:

```text
~/.claude/projects/**/*.jsonl
```

Mapping to repo can use the current logic from `src/commands/session-transcripts.ts`:

- project directory name encodes cwd
- fallback to checking transcript head for `"cwd":"<repo>"`

Local transcript inspection on 2026-05-11 confirmed that Claude JSONL root
transcripts include top-level `sessionId` and `cwd` fields on normal user,
assistant, and attachment records. Subagent transcripts live under
`subagents/`; v1 sweep should ignore subagent JSONL files unless we later decide
to capture them as part of their parent session.

### Codex

Known store:

```text
~/.codex/sessions/**/*.jsonl
```

Likely useful supporting files:

```text
~/.codex/session_index.jsonl
~/.codex/state_5.sqlite
```

Local transcript inspection on 2026-05-11 confirmed that Codex JSONL files start
with a `session_meta` record whose payload includes `id` and `cwd`. Later
`turn_context` records also include `payload.cwd`. Subagent transcripts can be
identified by `payload.thread_source === "subagent"` and a
`payload.source.subagent` object. v1 sweep should ignore subagent Codex
transcripts and capture only root threads.

The first implementation should prefer cheap filesystem discovery and parse
only the first few JSONL records to find cwd/session id. If Codex's index gives
stable cwd/session mapping, use it as an optimization behind the adapter, not as
the only source of truth.

### Cursor

Out of scope for v1. Do not attempt Cursor transcript detection in the first
scheduled-capture implementation.

## Eligibility model

For the first version, a session is eligible when:

```text
transcript exists
repo root with `.almanac/` can be determined
transcript has new content after the last captured cursor
transcript mtime is older than the quiet window
no capture is currently running for that repo/session
```

The default quiet window should be `45m`. Even with a 5-hour scheduler interval,
quiet time protects against the sweep firing while a user is actively working in
a long-running thread.

The quiet window:

- avoids capturing a transcript that changed seconds before the 5-hour sweep
- protects against partial-session summaries
- makes the eventual "poll every few minutes" version natural

Users who want pure interval behavior can set `--quiet 0m` if we choose to
support zero.

## Cursor-guided full-transcript capture

The key invariant:

> A session may be captured multiple times over its lifetime, but each sweep
> should tell the agent where the newly appended transcript content begins.

Example:

```text
Chat A has 800 messages.
Sweep 1 captures through message 800.
The user adds 200 more messages.
Sweep 2 passes the full original transcript again, with instructions to focus
on message/line 801 onward.
```

Use a per-transcript cursor in a repo-local ledger.

Minimal cursor:

```json
{
  "path": "/Users/me/.codex/sessions/2026/05/11/rollout.jsonl",
  "app": "codex",
  "sessionId": "019e...",
  "lastCapturedSize": 123456,
  "lastCapturedLine": 800,
  "lastCapturedPrefixHash": "sha256...",
  "lastCapturedAt": "2026-05-11T20:00:00.000Z",
  "lastRunId": "run_...",
  "status": "done"
}
```

Next sweep:

```text
if current size <= lastCapturedSize:
  skip

hash file[0:lastCapturedSize]
if hash matches lastCapturedPrefixHash:
  pass the original full transcript path to capture
  add cursor guidance: "already captured through line 800 / byte 123456"
else:
  handle prefix mismatch
```

Do not create truncated temporary transcript files. The agent should receive
the original full transcript path and cursor metadata. This keeps earlier
messages available for context while still making the desired capture boundary
explicit.

The Absorb prompt context should say that this is a continuation over the
original transcript:

```text
This transcript is from app <app>, session <sessionId>:
  <absolute transcript path>

This session was previously captured through line <lastCapturedLine> and byte
<lastCapturedSize>. Focus on line <lastCapturedLine + 1> onward. You may inspect
earlier lines only for context. Do not re-document decisions that were already
captured unless newer lines amend, invalidate, or add important nuance to them.
```

This matches the existing capture design: the prompt points the agent at files;
it does not paste the full transcript into the prompt. The agent uses filesystem
tools to inspect the transcript however it wants.

## Prefix mismatch behavior

Byte-offset cursors assume transcripts are append-only. That will usually be
true for JSONL, but robust code should verify it.

If the prefix hash does not match:

1. Do not blindly capture from the old byte offset.
2. Try a provider-specific stable message id or timestamp overlap if available.
3. If overlap is not implemented, skip the session and record
   `status: "needs_attention"` with a clear reason.

First version can choose a simpler policy:

```text
prefix mismatch -> skip and report in sweep summary
```

This avoids accidental duplicate or corrupted capture while preserving the
transcript for manual handling.

## Ledger location

Use a repo-local ledger:

```text
.almanac/capture-ledger.json
```

Repo-local is the right default because:

- capture state belongs to a wiki/repo
- run records are already repo-local under `.almanac/runs/`
- deleting a repo deletes its automation state naturally
- multiple repos can have independent cursors for the same user's agent apps

The ledger should be gitignored. If `.almanac/runs/` is already gitignored, an
alternative is:

```text
.almanac/runs/capture-ledger.json
```

That keeps transient automation state inside the existing ignored area.

Recommendation: store under `.almanac/runs/capture-ledger.json` unless there is
a strong reason to make it top-level.

## Concurrency and locking

Need two lock layers:

1. Sweep lock: only one sweep process should run at a time globally.
2. Repo/session lock: only one capture should run for the same repo/session
   cursor.

Simple first-version approach:

```text
~/.codealmanac/capture-sweep.lock
.almanac/runs/.capture-session-<safe-id>.lock
```

Locks should be stale-safe:

- include pid and created timestamp
- if pid is dead or lock is older than a generous timeout, allow replacement

Because captures are already background jobs, the sweep can choose either:

- start eligible captures and exit immediately
- avoid starting a new capture if any absorb run is already queued/running for
  the same repo

Recommendation for v1: avoid parallel capture per repo. It reduces merge
conflicts and keeps page writes calmer.

## Replacing hook-based auto-capture

There are no external users to preserve compatibility for, so v1 should remove
hook-based auto-capture from the product path rather than support two competing
automation systems.

Setup should stop asking:

```text
Install auto-capture hooks for Claude, Codex, and Cursor?
```

and instead ask:

```text
Enable automatic wiki updates?
Runs a local scheduled sweep every 5 hours and captures new Claude/Codex
session transcript updates for repos that have .almanac/.
```

The setup "yes" path should install the scheduler through the same code as:

```bash
almanac automation install --every 5h
```

Hook commands were deleted as part of the implementation. The important product
decision is that the default and documented automatic capture path is
scheduler-only. We should not keep a default hook install path just because the
old implementation had one.

## Config

Automation config can live in the existing CodeAlmanac config system if it is
already repo/global aware. Proposed shape:

```toml
[automation.capture]
enabled = true
every = "5h"
quiet = "45m"
apps = ["claude", "codex"]
```

The installed scheduler should call the CLI without baking all config values
into the plist where possible:

```bash
almanac capture sweep
```

Then the CLI reads config. If the interval changes, the scheduler registration
still needs updating because the OS owns the wakeup interval.

## Observability

`capture sweep` should print a compact summary:

```text
capture sweep:
  scanned: 18 sessions
  eligible: 2
  started: 2
  skipped unchanged: 12
  skipped active/quiet-window: 3
  needs attention: 1
```

`--json` should expose structured details for tests and scheduler logs.

`automation status` should show:

```text
auto-capture: installed
interval: 5h
last scheduler run: <timestamp if known>
last sweep result: <from log or state>
command: almanac capture sweep
```

Open question: where to store last sweep summary. Options:

- global automation state file under `~/.codealmanac/`
- per-repo ledger only
- scheduler logs only

Recommendation: global last-sweep state for automation status, plus per-repo
ledger for capture cursors.

## Implementation slices

### Slice 1: sweep dry-run over Claude

- Add `capture sweep --dry-run`.
- Discover Claude transcripts.
- Map to current repo only or all repos with `.almanac/`.
- Report candidates and eligibility.
- No scheduler yet.

### Slice 2: ledger and cursor-guided capture

- Add `.almanac/runs/capture-ledger.json`.
- Track byte/line cursor and prefix hash.
- Pass the original transcript path plus prior cursor metadata into Absorb
  capture context.
- Start normal background Absorb capture for eligible full transcripts.

### Slice 3: Codex discovery

- Discover `~/.codex/sessions/**/*.jsonl`.
- Parse enough metadata to find session id and cwd/repo.
- Feed candidates into the same sweep/ledger pipeline.

### Slice 4: macOS scheduler

- Add `automation install/status/uninstall`.
- Write launchd plist.
- Default interval `5h`.
- Add tests for plist rendering and install/status behavior with a temp home.

### Slice 5: setup and hook removal

- Replaced setup's hook prompt with scheduled auto-capture installation.
- Replaced `--skip-hook` style flags with automation-oriented naming:
  `--skip-automation` and `--auto-capture-every`.
- Removed `almanac hook ...` from the public command surface.
- Updated README and checked-in wiki pages so hooks are historical context, not
  the automatic capture contract.

## Decisions

1. Command names:
   - selected: `almanac automation install|status|uninstall`

2. Default quiet window:
   - selected: `45m`

3. Initial platform:
   - selected: macOS launchd only

4. Scope of first sweep:
   - selected: all transcripts that can be mapped to a repo with `.almanac/`

5. Cursor-guided capture in v1:
   - selected: pass full transcript with prior line/byte cursor guidance
   - selected: do not create temporary delta transcript files

6. Hook command removal:
   - selected: delete hook commands entirely

## Recommended agreement

For the first build, agree on:

```text
Command: almanac capture sweep
Scheduler command group: almanac automation <install|status|uninstall>
Default scheduler interval: 5h
Default quiet window: 45m
Apps: Claude and Codex
Scheduler platform: macOS launchd first
Capture unit: original transcript plus prior cursor guidance
Ledger: .almanac/runs/capture-ledger.json
Hooks: removed from default setup/onboarding and public CLI; automatic capture is scheduler-only
```
