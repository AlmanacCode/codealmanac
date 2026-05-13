---
title: Capture Automation
summary: CodeAlmanac's auto-capture contract is scheduler-backed quiet-session capture.
topics: [flows, agents, cli, automation]
files:
  - docs/plans/2026-05-11-scheduled-quiet-session-capture.md
  - src/commands/capture-sweep.ts
  - src/commands/automation.ts
  - src/update/config.ts
  - src/commands/session-transcripts.ts
  - src/commands/operations.ts
  - src/commands/setup.ts
  - src/commands/uninstall.ts
  - src/cli/register-setup-commands.ts
  - src/cli.ts
  - test/setup.test.ts
  - test/automation.test.ts
sources:
  - /Users/kushagrachitkara/.codex/sessions/2026/05/11/rollout-2026-05-11T14-32-08-019e18f4-5e73-7790-ba49-73cc02544a58.jsonl
status: implemented
verified: 2026-05-12
---

# Capture Automation

CodeAlmanac auto-capture is now quiet-session capture: provider-neutral scanning of session transcripts that treats inactivity as a synthetic session boundary. The 2026-05-11 capture discussion ended with a stronger conclusion than its earlier intermediate drafts: scheduler-backed quiet-session capture is the v1 automatic-capture contract because "session end" semantics differ across Claude, Codex, and likely Cursor.

The practical design goal is not "run exactly when an app says the session ended." The durable contract is "capture a session once its transcript has been quiet long enough to absorb safely." By the end of the same discussion, the preferred first shipping mechanism had also become clearer: use an OS scheduler to wake a deterministic sweep command on a configurable interval, with a default of about five hours, instead of requiring a permanently running daemon.

The concrete review artifact for that direction is [[docs/plans/2026-05-11-scheduled-quiet-session-capture.md]]. The implementation follows its first shipping shape: `almanac capture sweep` plus `almanac automation install|status|uninstall`.

## Current implementation caveats

The same 2026-05-11 session ended with a code review of the shipped scheduler path, and the fixes became part of the automation contract:

- Setup and uninstall treat scheduler automation as the only public auto-capture path and also clean up legacy Claude/Codex/Cursor hook installs privately.
- Legacy hook cleanup has to recognize multiple provider-era names for the same idea, including `SessionEnd`, `Stop`, and `sessionEnd`, so scheduler migration does not assume one canonical hook label.
- That cleanup is content-based and recursive, not just key-based: it removes old `almanac-capture.sh` command objects from wrapped and unwrapped hook shapes, then prunes now-empty event arrays or wrapper containers so setup/uninstall can heal provider hook files in place.
- `runAutomationInstall()` writes a launchd plist with absolute `node` and `dist/codealmanac.js` program arguments instead of relying on `almanac` being on launchd's reduced `PATH`.
- `runAutomationInstall()` records `automation.capture_since` in `~/.almanac/config.toml` the first time scheduled capture is enabled, and later reinstall runs preserve the original activation baseline.
- `almanac capture sweep` skips transcript files whose mtime predates `automation.capture_since` with the `before-automation-activation` reason, so first-run automation does not backfill a user's entire historical chat corpus.
- The sqlite-free fast path in [[lifecycle-cli]] handles `automation install|status|uninstall` before Commander loads, and validates `automation install --every` explicitly.
- Transcript metadata discovery reads only an initial header chunk for the first lines rather than loading whole transcript files during metadata scanning.

## Why hooks were removed

The old hook investigation documented the mismatch clearly:

- Claude has a real `SessionEnd` hook.
- Codex currently exposes `Stop`, which is turn-scoped rather than session-scoped.
- V1 capture discovery is Claude-first today and still lacks Codex/Cursor discovery without explicit transcript paths.

That means hook-driven automation couples CodeAlmanac to each provider's lifecycle model. A provider-neutral scanner gives CodeAlmanac its own timing and dedupe rules instead of inheriting whatever "done" means in the foreground app.

Because there were no external users whose existing hook workflows had to be preserved, v1 does not present hook install and scheduled sweep as two coequal auto-capture products. The documented automatic path is scheduler-backed quiet-session capture.

## Codex hook-name provenance

One durable lesson from the 2026-05-11 investigation is that Codex hook naming should be treated as an observed compatibility surface, not a stable contract inferred from one doc page.

The session verified this from several angles:

- the live machine had Codex hooks enabled via `codex features list`
- the installed `codex` binary resolved to the global `@openai/codex` npm package
- searching that installed package did not reveal a local `SessionEnd` hook contract to depend on
- public and local evidence still pointed to `Stop` for Codex, while historical Claude/Cursor-era configs and older examples also used `SessionEnd` or `sessionEnd`

That is why [[src/commands/automation.ts]] removes CodeAlmanac-owned legacy hook commands by content and by multiple event names instead of assuming one canonical key. The current cleanup and tests should preserve compatibility with at least these observed shapes:

- `~/.claude/settings.json` with `SessionEnd`
- `~/.codex/hooks.json` with `Stop`
- `~/.cursor/hooks.json` with `sessionEnd`

Future agents should read this as a cleanup invariant, not just historical trivia: if scheduler migration ever regresses, the likely cause is overfitting to one provider's current hook spelling or wrapper shape.

## Product contract

The later turns in the 2026-05-11 session clarified the concept more sharply: the product behavior is quiet-session capture, while cron or a daemon is just the mechanism that notices quiet sessions.

The intended rule is:

> A session becomes capturable when its transcript has been stable for the quiet window.

That gives CodeAlmanac a synthetic `SessionEnd` derived from transcript inactivity. For Codex this is more honest than treating `Stop` as a true end-of-session signal, and for Claude it may still be more robust than trusting hook delivery alone.

The key state model implied by the discussion is:

- transcript id or path
- last seen mtime
- last seen size or content hash
- captured hash or captured offset
- capture status

## Long-term scheduler contract

The durable contract proposed in the 2026-05-11 session is:

1. Run a lightweight background scanner every few minutes.
2. Detect new or changed session transcripts across supported apps.
3. Record durable per-source cursors such as transcript path, mtime, session id, offset, or content hash.
4. Treat a transcript as capturable only after it has stayed unchanged for the quiet window.
5. Start `almanac capture` only when there is new eligible material.
6. Deduplicate aggressively so retries or overlapping sweeps do not double-write wiki pages.

This reframes auto-capture as "background gardening/capture" rather than live sync.

The important distinction is that polling frequency is not capture frequency. A sweep may run every 5-10 minutes, but it should usually do nothing except cheap filesystem checks. Capture only starts once a transcript has stayed unchanged for the quiet window and has not already been absorbed at the same content version.

In steady state the cheap path is:

- stat transcript files
- compare mtime and size against the ledger
- compute a content hash only for quiet candidates
- read only enough transcript content to recover header metadata such as `sessionId` and `cwd`
- exit if nothing newly eligible exists

That keeps the scheduler inexpensive enough to run often without turning every tick into an agent invocation.

The same discussion also made one design tension explicit: this "cheap frequent poller" is the cleanest long-term contract, but it is not the only acceptable first implementation. Later turns pivoted toward a calmer initial rollout with a configurable scheduled sweep that still honors the same quiet-session rules.

## Why the quiet window matters

The quiet window is not mainly about rate limiting. It is the guard against absorbing half-finished sessions.

Without a quiet window, a scheduled sweep can wake up while a transcript is still actively growing, capture an unfinished decision, and then capture the same thread again later after the user continues working. The intended rule is simple: only process transcripts whose mtime has been stable for long enough that the session is probably coherent.

The 2026-05-11 discussion converged on roughly 30-60 minutes, with a separate lightweight scanner running every few minutes so finished sessions are picked up soon after work actually stops.

## First shipping shape

By the end of the session, the preferred near-term implementation was more concrete than the earlier "every few minutes" sketch:

- a scheduler wakes on a configurable interval
- the default interval is about `5h`
- each wake runs one deterministic sweep command
- the sweep still applies a quiet window before capture
- the scheduler mechanism stays outside the main capture logic

In other words, the product boundary is still quiet-session capture, but the first operational shape is "scheduled sweep with configurable cadence," not "always-on daemon."

The command surface is:

- `almanac capture sweep`
- `almanac capture sweep --quiet 45m`
- `almanac capture sweep --apps claude,codex`
- `almanac capture sweep --dry-run`

The matching install surface for automation is:

- `almanac automation install`
- `almanac automation status`
- `almanac automation uninstall`
- `almanac automation install --every 5h`

The same discussion briefly revisited whether scheduler controls should live under `capture` instead, for example `almanac capture schedule ...`. But the final plan edit in that session explicitly normalized the recommendation back to `almanac automation <install|status|uninstall>`. The durable boundary stayed the same either way: one command family decides capture eligibility (`capture sweep`), and the other only manages whether the operating system wakes that sweep automatically.

## Why automation is separate from sweep

The late-session "what are these commands?" exchange clarified an important UX boundary: `almanac capture sweep` and `almanac automation ...` are meant to solve different problems.

`almanac capture sweep` is the work command. It scans transcripts, applies quiet-window and dedupe rules, and starts normal capture runs for any newly eligible session material.

`almanac automation install`, `status`, and `uninstall` are scheduler-management commands. They would not decide capture eligibility themselves. Their job is only to register, inspect, or remove the OS-owned wakeup that later runs `almanac capture sweep` on a cadence.

The durable distinction is:

- `capture sweep`: decide what to capture
- `automation install|status|uninstall`: decide whether the operating system should run that sweep automatically

That split keeps manual and automatic behavior aligned. A future bug in scheduling should not change capture semantics, and a future change in capture eligibility should not require redefining what "installed automation" means.

The later turns of the same session kept the exact product naming open, but the concrete recommendation in the proposal doc ended at `almanac automation ...`, not `almanac capture schedule ...`. Future work can still revisit the wording for product legibility, but the captured synthesis should treat `automation` as the current proposed surface.

## Onboarding and setup

The late-session follow-up after the plan doc was drafted made one more product boundary explicit: if scheduled capture ships, users should probably encounter it through setup rather than being expected to discover `almanac automation install` on their own.

The preferred onboarding shape discussed in the session was:

1. `codealmanac` or `codealmanac setup` asks whether to enable background automatic capture.
2. Accepting that prompt installs the scheduler-backed sweep.
3. Power-user commands such as `almanac capture sweep` and scheduler-management commands remain available for inspection and control.

Later turns in the same session made the v1 product decision stricter than that intermediate framing: setup should replace the hook prompt, and the documented automatic-capture path should be scheduler-only rather than "hooks plus scheduler." Setup now asks about automatic wiki updates and uses `--skip-automation` / `--auto-capture-every` for automation controls.

The same plan revision also proposed the likely replacement wording:

```text
Enable automatic wiki updates?
Runs a local scheduled sweep every 5 hours and captures new Claude/Codex
session transcript updates for repos that have .almanac/.
```

The intended "yes" path is the same product action as:

```bash
almanac automation install --every 5h
```

## Current implementation anchor

The 2026-05-11 proposal doc narrows the first implementation more than the earlier discussion did, and the shipped implementation follows that narrowed shape:

- default scheduler interval: `5h`
- default enabled apps: Claude and Codex
- scheduler role: OS-owned wakeup only
- sweep role: deterministic discovery, eligibility, dedupe, and enqueue
- quiet window: still applied by the sweep even when the scheduler cadence is coarse
- onboarding path: replace hook install with scheduler install
- automatic-capture contract: scheduler-only, not hook-plus-scheduler

That matters because two different ideas appeared in the same discussion and should not be conflated:

- long-term ideal: frequent cheap polling with quiet-window gating
- first shipping shape: configurable scheduled sweep, defaulting to a calmer `5h` cadence

Future edits should preserve that distinction unless the proposal itself changes.

## Scheduler wakeup model

The session explicitly rejected the idea that CodeAlmanac itself should keep a sleeping process alive to count time. The intended wakeup mechanism is platform-owned scheduling:

- macOS: `launchd`, likely via `~/Library/LaunchAgents/com.codealmanac.capture-sweep.plist`
- Linux: `systemd --user` timer, with cron as fallback
- Windows: Task Scheduler later if Windows support is added

The key implementation invariant is that the scheduler only invokes the CLI. It should not embed transcript-discovery or capture logic itself.

That keeps the system debuggable:

- manual and automatic behavior use the same sweep command
- tests can target sweep logic without involving `launchd`
- scheduler bugs stay small and platform-specific

The same session tightened that separation one step further: the scheduler entry should only need wakeup-level state such as interval, command path, and log paths. Sweep behavior such as enabled apps, quiet window, and other capture defaults should live in CodeAlmanac-owned config that `almanac capture sweep` reads when it starts. For the first version, even that split can stay minimal: the wakeup cadence may still be the only scheduler-owned knob, and changing it would rewrite or reload the platform scheduler entry.

The current macOS implementation now follows that stronger shape. `runAutomationInstall()` writes launchd `ProgramArguments` as the absolute Node executable plus the resolved `dist/codealmanac.js` entrypoint, then appends `capture sweep`. The scheduler still stays intentionally thin, but it no longer depends on `almanac` being present on launchd's reduced `PATH`.

## Verification status

The implementation was verified in-repo with `npm run lint`, `npm test`, and `npm run build`, and the test coverage called out in the session included launchd plist generation, setup/uninstall automation behavior, sweep discovery, quiet-window handling, repo locking, subagent skipping, and CLI parsing.

The same review also did a more realistic manual smoke pass on `almanac capture sweep` itself. That run surfaced and then fixed a concrete CLI regression: `capture sweep --json` initially printed human-readable text because the `--json` flag was being captured on the parent `capture` command instead of the `sweep` subcommand. After the fix, dry-run emitted structured JSON again, still avoided writing `.almanac/runs/capture-ledger.json`, and confirmed mixed discovery from real local transcript stores rather than only fixture data.

One specific observation from that smoke pass is worth keeping as a sanity anchor for future regressions: on the developer's machine, the fixed dry-run reported 478 eligible sessions across both apps, split between 255 Claude sessions and 223 Codex sessions, with one additional Codex session skipped. The exact counts are temporal, but the durable lesson is that Codex discovery was verified against a live transcript corpus after the scheduler refactor and should not be treated as merely test-only behavior.

That machine-level macOS smoke test was completed on 2026-05-12. The important proof points were:

- `node dist/codealmanac.js automation install` wrote a launchd plist whose `ProgramArguments` used the absolute Node executable plus the resolved `dist/codealmanac.js` entrypoint.
- The same plist also wrote `EnvironmentVariables.PATH`, preserving the install-time shell PATH so launchd could find user-managed CLIs such as a Codex binary installed under `nvm`.
- A temporary stress configuration of `--every 1m --quiet 1s` produced real scheduled sweeps, started Codex absorb jobs successfully after the PATH fix, and those jobs completed with wiki page updates rather than failing at process startup.

Future debugging around scheduled capture should still treat "repo tests passed" and "launchd actually invoked the sweep on this machine" as separate claims, but that separation is now a verification workflow lesson rather than an untested gap.

## Global scope and first-run backlog

The same smoke-test thread clarified one easy-to-miss operational boundary: `almanac capture sweep` is not scoped to the current repo. Discovery walks the user's global Claude and Codex transcript stores, recovers each transcript's recorded `cwd`, then maps that `cwd` upward to the nearest repo containing `.almanac/`.

That means one manual or scheduled sweep can enqueue work for multiple repos at once. On the developer's machine during the first real dry-run after the scheduler refactor, the eligible backlog mapped to four repos, not just `codealmanac`.

The temporal counts from that machine should not be treated as product guarantees, but they do preserve an important sizing lesson:

- 478 eligible sessions across 4 repos
- 255 Claude sessions and 223 Codex sessions, with 1 additional Codex session skipped
- roughly 777 MB / 813.9 million characters of transcript text across the eligible backlog
- roughly 203 million tokens by the common `chars / 4` estimate, with a rough range around 163M-271M tokens

The durable conclusion is not the exact number. It is that a long-lived workstation can accumulate an enormous first-run backlog, so "scheduler works" and "first automatic sweep is operationally safe" are separate questions.

Future work around rollout or defaults should preserve three consequences from that observation:

- the first sweep may need to be treated as backlog migration rather than ordinary steady-state capture
- a throttling control such as `max sessions per sweep` may be operationally necessary even though it is not yet part of the current command surface
- any future cap must delay eligible work, not silently discard it

The final turn of the same session tightened that rollout stance further: automatic capture should not backfill historic transcripts by default at all. The implemented product behavior is to record an automation activation timestamp when the user enables scheduled capture, then have future sweeps consider only transcripts modified after that baseline. Historical transcripts can still be counted and reported as ignored, but they should not silently become the initial backlog for a new automation install.

Future work in this area should preserve the distinction between:

- historical transcript inventory that predates automation enablement
- new transcript activity that happened after automation became active
- repo-local ledger progress for transcripts that were actually eligible to capture

The implementation stores that baseline as `automation.capture_since` in the global config schema. `runAutomationInstall()` writes it only when no valid value already exists, which keeps setup and reinstall idempotent: re-running setup refreshes the launchd plist but does not accidentally move the capture boundary forward and skip active post-install sessions.

## Manual smoke ladder

The same session also converged on a practical verification ladder that future debugging should reuse instead of jumping straight to `launchd`:

1. Build and inspect command help: `npm run build`, `node dist/codealmanac.js --help`, `node dist/codealmanac.js automation --help`, `node dist/codealmanac.js capture sweep --help`.
2. Run `node dist/codealmanac.js capture sweep --dry-run --json` to verify discovery, option parsing, and ledger read-only behavior.
3. Run a real manual sweep such as `node dist/codealmanac.js capture sweep --quiet 1s --json` and inspect `.almanac/runs/capture-ledger.json` for pending cursor state.
4. Install and inspect automation with `node dist/codealmanac.js automation install`, `automation status`, and the generated `~/Library/LaunchAgents/com.codealmanac.capture-sweep.plist`.
5. Only then treat `launchctl kickstart -k gui/$(id -u)/com.codealmanac.capture-sweep` plus log inspection under `~/.almanac/logs/` as the machine-level proof that macOS actually runs the job.

This ladder matters because the session found a real regression at step 2 before any OS-level scheduling was involved: help output looked correct, but `capture sweep --json` initially failed at runtime until the command started reading merged parent/leaf options.

One later operational lesson from the same ladder is easy to miss: changing the scheduler interval does not stop absorb jobs that were already spawned by an earlier sweep. In the 2026-05-12 `1m / 1s` stress test, reinstalling automation back to `5h / 45m` changed future wakeups but did not cancel already-running absorb jobs. Debugging "is automation still spawning new work?" therefore has to distinguish between:

- future launchd wakeups, controlled by the current plist
- already-running absorb jobs, controlled by the jobs/run store

Resetting or uninstalling automation stops new scheduled sweeps; cleaning up already-started absorb jobs is a separate action.

## Suggested defaults

The 2026-05-11 discussion ended with two different "default" ideas that should not be conflated:

- long-term scanner posture: wake every few minutes and cheaply discover quiet sessions
- first shipping scheduler posture: configurable interval with a default around `5h`

The shared capture defaults under either posture were:

- quiet window: about 30-60 minutes
- apps: Claude and Codex first
- concurrency: at most one active capture sweep per wiki

`max sessions per sweep` remained a possible throttling control, but the more important invariant was preserved more strongly than the number: a cap may delay work, but it must not silently drop eligible sessions.

The 2026-05-12 launchd stress test added one more practical calibration to those defaults. Extremely aggressive settings such as `--every 1m --quiet 1s` are useful for proving the scheduler and PATH wiring, but they are intentionally unrealistic for normal use: an active transcript can become re-eligible almost immediately after each new burst of conversation, which leads to many continuation captures against the same session over a short period. The product-level conclusion is not that the scheduler is broken; it is that the calm default posture (`5h` interval, `45m` quiet window) is part of the operational contract, not just a convenience.

That stress test also made a subtler ownership rule visible. The repo-local `capture-sweep.lock` only prevents overlapping sweeps from mutating the same wiki at the same time; it does not protect against a later sweep that starts after the earlier one released its lock but before the absorb job it spawned has finished. Preventing repeated continuation captures for the same transcript therefore depends on both layers together:

- the repo lock serializes sweep-side ledger mutation and enqueue decisions
- the [[capture-ledger]] `pending` state reserves a transcript's new cursor range until the corresponding background run resolves

Future debugging should keep that distinction in mind. A burst of many jobs from one transcript usually means the ledger failed to record or honor pending ownership, not that the per-repo lock stopped working.

## Installation model

The same 2026-05-11 discussion also clarified that quiet-session capture should not require users to discover or manage a separate long-running daemon. If this ships, CodeAlmanac itself should install a user-level scheduler entry that runs the scanner command on a cadence.

The durable product idea is "register CodeAlmanac's background sweep," not "install another background service." Proposed examples in the session included a dedicated surface such as `almanac automation install|status|uninstall` or folding the same action into a broader first-run setup flow.

The scheduler mechanism is platform-owned:

- macOS: `launchd` agent under `~/Library/LaunchAgents/`
- Linux: `systemd --user` timer, with cron as a weaker fallback
- Windows: Task Scheduler if Windows support is added later

The agent-facing command discussed in the session was conceptually a sweep such as `almanac capture sweep --quiet 45m`, run by the platform scheduler on a configurable cadence. Early in the discussion that cadence was imagined as every few minutes; later turns settled on "default around five hours, user-configurable" for the first implementation.

Two product constraints came through clearly:

- automatic capture should be opt-in
- the installed background behavior should be visible and inspectable through CodeAlmanac UX rather than feeling mysterious

## Sweep mechanics

The discussion converged on the deterministic sweep command shape `almanac capture sweep --quiet 45m`.

The intended mechanics are:

1. Load the repo-local [[capture-ledger]] for the wiki.
2. Discover transcript files across supported apps.
3. Read cheap metadata first: transcript path, mtime, size, session id, and repo hint when available.
4. Skip transcripts modified within the quiet window.
5. Map each transcript to a repo or nearest `.almanac/`.
6. Compute a content fingerprint only for quiet candidates.
7. Skip versions already captured.
8. Acquire a singleton lock for the wiki so overlapping sweeps cannot race.
9. Enqueue normal `almanac capture` work for the eligible transcript.
10. Record transcript identity, cursor state, run id, and status.

The "map each transcript to a repo" step means the scheduler is expected to run globally, not from inside one specific repo. A single sweep may see transcripts from many working directories, recover each transcript's `cwd` or repo hint, walk upward to the nearest parent containing `.almanac/`, and skip sessions whose repo tree has no wiki. In practice the mapping is:

- transcript metadata -> working directory
- working directory -> nearest ancestor with `.almanac/`
- nearest `.almanac/` -> repo-local ledger and `almanac capture` run

That is why one installed `launchd` or `systemd --user` job can service every repo on the machine that has adopted CodeAlmanac. The scheduler itself is global plumbing; capture ownership stays repo-local after the transcript is mapped.

For the proposed first version, the unit of work is intentionally small: one eligible transcript continuation becomes one capture job. The sweep may discover many eligible transcripts in one pass, but it should enqueue them as separate `almanac capture` runs rather than batch several sessions into one Absorb prompt. That keeps retry, dedupe, and repo attribution simple while the ledger and scheduler contracts are still new.

Later turns refined that final step into a two-phase cursor model rather than "mark captured as soon as a job is queued." The shipped v1 posture is:

- when the sweep enqueues a capture, record pending cursor fields plus `pendingRunId`
- on the next sweep, reconcile any `queued` or `running` ledger entries against `.almanac/runs/<run-id>.json`
- only promote the pending cursor to the durable "captured through here" cursor after the background capture job actually finished successfully

The implementation also now takes the concurrency requirement literally: each repo acquires `.almanac/runs/capture-sweep.lock` before mutating ledger state or enqueueing work, so overlapping sweeps skip that repo instead of racing to enqueue duplicate captures.

That recommendation preserves dedupe without pretending a queued background job already succeeded.

The session started with a loose repo-local ledger idea and later narrowed it to a stronger v1 recommendation: store sweep-owned cursor state under `.almanac/runs/capture-ledger.json`.

That recommendation matters because it keeps scheduler state repo-local instead of global user state, and it colocates reconciliation with the existing [[process-manager-runs]] records the sweep already needs to inspect. The stronger invariant is still more important than the exact filename: quiet-session automation needs durable dedupe state, overlap protection, and reconciliation against background capture job results. But as of the 2026-05-11 discussion, `.almanac/runs/capture-ledger.json` is the current recommended home rather than an unresolved placeholder. See [[capture-ledger]] for the state model.

The transcript discovery scope discussed for the first version was explicitly multi-provider, but not "all apps":

- Claude transcripts under `~/.claude/projects/**/*.jsonl`
- Codex transcripts under `~/.codex/sessions/**/*.jsonl`

Cursor was explicitly pushed out of scope for the first scheduled-capture build. The intent was to ship Claude and Codex discovery first, then add a Cursor adapter later once its transcript location and stable repo-mapping metadata are verified.

Each discovered source should normalize into a common internal record before filtering:

```ts
{
  app: "claude" | "codex",
  sessionId: string,
  path: string,
  cwd: string | undefined,
  mtimeMs: number,
  size: number
}
```

Claude repo mapping is expected to be easier because project folder names encode cwd. Codex may require reading transcript metadata or a session index to recover cwd reliably.

## Scheduler execution model

The 2026-05-11 session clarified one operational detail that is easy to hand-wave but important for future implementation: CodeAlmanac is not meant to keep its own sleeping background process alive.

On macOS, scheduler install is expected to write a user `launchd` entry such as:

- `~/Library/LaunchAgents/com.codealmanac.capture-sweep.plist`

That plist owns the wakeup interval, likely via `StartInterval = 18000` for the default five-hour cadence, and launches a fresh CLI process each time:

- command: `almanac capture sweep`
- stdout/stderr: user-visible log files under a CodeAlmanac-owned log directory

`launchd` is the thing that stays resident. When the timer fires, macOS starts a new `almanac` process, waits for it to exit, and then returns to sleeping until the next interval. The same separation should hold on Linux with a `systemd --user` timer and later on any Windows scheduler support.

This separation is part of the product contract, not just an implementation convenience:

- scheduler layer: owns wakeup timing and process launch
- sweep layer: owns transcript discovery, quiet-window checks, repo mapping, dedupe, ledger reconciliation, and capture enqueueing

Because of that split, `almanac capture sweep` must remain runnable by hand for debugging. Automatic capture should be the scheduler invoking the same deterministic sweep command a user can run manually, not a hidden alternate code path.

## Cursor and continuation-capture model

The later turns of the session refined the dedupe requirement into a stronger per-transcript cursor model. [[capture-ledger]] is the current canonical page for that cursor and reconciliation contract.

If a session transcript was previously captured through message or byte position `X`, and more content is appended later, the next sweep should capture only the new continuation semantically, but it does not need to hand Absorb a physically sliced transcript file.

The proposed durable cursor fields were:

- `lastCapturedSize`
- `lastCapturedLine` or equivalent cursor
- hash of the previously captured prefix
- `lastCapturedAt`
- `lastRunId`

The intended algorithm was:

1. detect that the transcript grew since the last capture
2. verify the old prefix still matches by comparing a stored prefix hash
3. if it matches, run capture against the original full transcript path with cursor instructions telling Absorb to focus on material after the last captured line/byte unless earlier lines are needed for context
4. if it does not match, treat the transcript as rewritten and fall back carefully

That keeps append-only transcripts incremental by default while still preserving access to earlier context and guarding against file rewrites or compaction that would make byte offsets unsafe.

The discussion's preferred fallback posture was conservative:

- verified append-only transcript: capture only the new continuation, using the original transcript plus cursor context
- prefix mismatch: treat as rewritten and fall back carefully, potentially to a full recapture path with overlap awareness

## Current recommended agreement

If a future implementation session needs the shortest faithful restatement of the current plan, it is:

- introduce `almanac capture sweep` as the only place that decides session eligibility
- add scheduler install/status/uninstall commands that only manage OS scheduling
- start with Claude and Codex transcript discovery
- use per-transcript cursors as described in [[capture-ledger]] so append-only sessions capture only new continuation instead of replaying whole transcripts
- replace setup's hook install prompt with scheduled auto-capture installation
- treat hook-based auto-capture as historical/current plumbing to remove or hide, not as a coequal v1 automation path
- keep backlog entries durable when a sweep hits caps or transient failures

[[capture-flow]] remains the source of truth for how manual and scheduled capture bridge into Absorb.

## Backlog and throttling invariants

`max sessions per sweep` is a throttling control, not a retention rule.

If more eligible sessions exist than one sweep is willing to process, the remainder should stay in a durable backlog and be picked up by later sweeps. The scheduler may delay work to control cost, lock duration, or wiki churn, but it should not silently drop eligible sessions because a run hit its cap.

The durable state model implied by the session is:

- pending sessions remain queued until processed or explicitly skipped
- processed sessions are recorded by transcript identity plus cursor or hash
- failed sessions remain retryable, ideally with backoff
- per-sweep caps only limit how much work one run performs

This yields the key invariant for future scheduler work: CodeAlmanac may delay capture, but it must never silently discard eligible sessions.

## Relationship to current V1 behavior

V1 supports explicit `almanac capture` runs and scheduler-backed `almanac capture sweep`. The old hook path is historical context, not current product surface.

Future work in this area should keep three layers separate:

- current implementation details
- provider-specific hook quirks that explain why the old auto-capture path is being retired
- the higher-level automation contract the product now uses

That separation helps avoid repeating the mistaken assumption that Codex `Stop` is equivalent to a true session-finished event.

`[[capture-flow]]` has the right boundary for this design: transcript resolution happens before Absorb, and no-op captures are normal. The scheduler extends that model from "explicit args or Claude discovery" toward "periodic multi-app discovery with persisted cursors."

`[[process-manager-runs]]` is also the right place to preserve run visibility, but scheduled capture likely needs an additional singleton guard so overlapping ticks cannot enqueue competing sweeps for the same wiki.

## Design stance

The intended posture is background wiki maintenance, not live synchronization. "Notice quiet sessions and absorb them once they look stable" matches the wiki's role as cultivated project memory better than trying to mirror every conversational turn. The same stance also explains the first-version compromise: a five-hour default scheduler may be less immediate than a frequent poller, but it still respects the higher-level quiet-session contract while keeping the first automation surface simpler and calmer.

## Open questions

- Should the recommended `.almanac/runs/capture-ledger.json` file remain a plain JSON ledger, or eventually move into SQLite once sweep state grows more relational?
- Where should the automation activation timestamp live so sweeps can ignore pre-install history without smuggling global scheduler state into each repo ledger?
- Should the first scheduler version ship with a generous default cap, or with no cap until backlog accounting exists?
- Should the first scheduler version eventually add caps/backoff controls, or is the current no-cap sweep acceptable until real usage suggests otherwise?

## Related pages

- [[capture-flow]]
- [[lifecycle-cli]]
