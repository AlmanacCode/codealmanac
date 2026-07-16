# CLI Telemetry Live Agreement

Last updated: 2026-07-16

This is the running implementation context for the CLI telemetry goal. Update it
after every meaningful implementation, external PostHog, review, or verification
checkpoint. Code and tests remain the source of truth.

## Goal

Ship unobtrusive, opt-out CLI product telemetry and error tracking end to end,
including a fresh PostHog US project, a `CLI Product Health` dashboard, privacy
proofs, automated tests, and disposable real-world command/background-job smoke
tests.

## Git state

- Development branch: `codex/cli-telemetry`
- Current rebased base: `origin/main` at `d2b8b8f8`
- Plan commit: `a40ef638`
- Onboarding/config commit: `f64c893d`
- Almanac architecture commit: `4e8e9661`
- Telemetry implementation/test commit: `8c193253`
- Exact production QA documentation commit: `d80b1aee`
- Linux CI test-isolation fix: `4edfe89a`
- Review-fix plan commit: `22e81980`
- Main merge commit: `ddee1934`
- Diligent review-fix commit: `463de759`
- Follow-up review-fix plan commit: `09964628`
- Follow-up review-fix commit: `438d789b`
- Latest-main rebase record: `6523627f`
- Unrelated untracked user files must not be staged or modified.

## Settled product decisions

- Setup order is provider, model, instructions, wiki maintenance, product
  updates, agent change handling, telemetry permission.
- Telemetry is the final screen, defaults to a benefit-led recommended Yes, and
  keeps a visible functional No.
- `setup --yes` chooses the saved/default Yes; `--no-telemetry` explicitly opts
  out. No first-run notice machinery.
- The anonymous identity is a stable UUID stored in local SQLite. Config TOML
  stores only `telemetry.enabled`.
- UUID-backed PostHog person profiles are enabled. Without future login they have
  no name or email. GeoIP is disabled.
- A future login will alias the installation UUID to an opaque account ID; the
  typed identity seam already preserves this path.
- Capture all public top-level commands with controlled actions. Never capture
  raw args, queries, selectors, paths, repository/run IDs, prompts, source,
  transcripts, Git data, or provider session IDs.
- Capture lifecycle outcomes for build/ingest/garden exactly once, including
  background failures and cancellations.
- Capture real unhandled foreground, worker, and executor exceptions in PostHog
  Error Tracking. Do not turn normal provider or validation failures into fake
  exceptions. Send only exception type, stable fingerprint, and CodeAlmanac
  module/function/line frames; never send exception text, locals, code variables,
  or source context.
- Telemetry is best effort and detached. It must not change output, exit status,
  or command latency. No outbox/retry queue in v1.

## Implemented and verified

- Written implementation plan:
  `docs/plans/2026-07-15-cli-telemetry.md`.
- Config model, config commands, setup request/service, seven-step wizard,
  `--no-telemetry`, and exact ordering.
- Focused onboarding/config verification: 88 tests passed; focused Ruff passed.
- Typed telemetry envelope and identity model.
- Stable UUID singleton and exact-once event claims in SQLite.
- Policy reload on every event; config opt-out, `CODEALMANAC_NO_TELEMETRY`,
  `DO_NOT_TRACK`, and CI suppression.
- Structural exception envelope with CodeAlmanac-only module/function/line
  frames and stable fingerprint; arbitrary exception text never enters an event.
- Supported PostHog Python SDK dependency.
- Detached one-shot sender with bounded stdin JSON, no output, no waiting,
  GeoIP disabled, person processing allowed, SDK exception autocapture off, and
  code-variable capture off.
- Composition-root injection seam for fake senders.
- Foreground CLI completion/failure/crash capture and controlled action mapping.
- Central run telemetry emits exact-once done, failed, and cancelled outcomes;
  worker and executor crashes use distinct process kinds and controlled failure
  categories.
- Fresh PostHog US project `CodeAlmanac CLI` exists as project `514800` and the
  public ingestion token is packaged. Project IP anonymization is enabled,
  session replay remains off, and retention remains at its default.
- Real dogfood proved the stable SQLite UUID maps to one anonymous profile with
  no name, email, or username. Latest events have GeoIP disabled and strip SDK
  full OS/runtime/library fields before upload.
- A sanitized CodeAlmanac-frame exception created active Error Tracking issue
  `019f69c3-7487-7853-81af-121da0f06d2f` without paths, secrets, locals, or code
  variables.
- `CLI Product Health` dashboard `1857079` is the project default. Its original
  eight tiles force-ran successfully: active installations, weekly retention,
  command/action adoption, activation, command success, lifecycle outcomes and
  failure categories, exception volume, and version/platform distribution.
- A structural review found and fixed six edge cases: interactive
  `--no-telemetry` can no longer be reversed, the foreground process no longer
  imports the PostHog SDK, exception sanitization removes generic paths and
  parser-supplied values, uninstall freezes the pre-removal opt-out policy,
  worker wait failures remain visible after durable completion, and a missing
  current directory cannot let telemetry mask the original exception.
- Foreground interruption plus worker, executor, and scheduler crash boundaries
  have focused coverage.
- The final wheel built and installed into an isolated virtualenv. Its disposable
  journey verified non-interactive Yes, interactive No and Yes, explicit
  `--no-telemetry`, config opt-out, one stable UUID, three worker spawns, and
  successful build/ingest/garden terminal events without repo, transcript, or
  session identifiers in any envelope.
- Final serial gates passed: 534 pytest tests, Ruff, `git diff --check`, wheel
  build/install/import/version checks, and `codealmanac validate` over 71 pages.
- The final live PostHog audit confirmed IP anonymization, session replay off,
  person-on-events enabled, an empty UUID profile property map, the active
  sanitized Error Tracking issue, and successful force-refresh of all eight
  dashboard tiles. All post-hardening events omit SDK full OS/Python/library
  fields; the first retained pre-hardening dogfood command is the only historical
  event containing them.

## Exact final-commit production QA

On 2026-07-16, commit `da82eac9` was rebuilt as a wheel, installed into a new
virtualenv, and exercised against live PostHog from a disposable home and repo.
This closes the gap between the earlier live transport smoke and the final
reviewed package:

- Real `config get` and `config list` CLI processes traveled through the
  detached child and appeared in PostHog under installation UUID
  `fa20d035-0853-4eca-ac6c-59695dcef732`.
- The final audit found exactly three command events, two lifecycle events, and
  two exceptions on one PostHog person. Its person property map remained empty.
- Command events contained the allowlisted command/action/outcome, version,
  coarse platform, duration, and GeoIP-disable fields. Checked IP, GeoIP country,
  email, name, argv, query, path, repository/run identifiers, prompt,
  transcript, and SDK full runtime/library fields were all absent.
- Calling the same successful durable finish twice produced one `garden/done`
  event. A real worker spawn exception produced one `garden/failed` event with
  `internal_error`; the local delivery table contained exactly the two terminal
  claims.
- The worker OSError created issue `019f69e3-9563-7a81-81cf-e630049ea96a` with
  `cannot spawn executor at <path> token=<redacted>`. A real hidden executor
  crash joined the existing ValueError issue. Both retained only in-package
  CodeAlmanac frames and no session, URL, locals, environment, code variables,
  run IDs, or repository IDs.
- Setting telemetry false and running another command left the live event count
  unchanged. Each environment opt-out also ran successfully without creating a
  telemetry database. Help, version, and syntax-error paths created no identity.
- Routing the detached child through a dead proxy left the foreground command's
  output and zero exit code unchanged; it returned in 0.509 seconds and no event
  appeared for that disposable UUID.
- Twenty concurrent first-use processes resolved one UUID, and twenty concurrent
  claims produced exactly one winner. Corrupt UUID and delivery-table state did
  not break a valid command or durable run.
- The wheel metadata declares Python 3.12+, contains only the public `phc_`
  ingestion token, contains no `phx_` personal-key pattern, and keeps the PostHog
  SDK out of the foreground import path. The full suites passed all 534 tests on
  both Python 3.12.10 and Python 3.13.3.
- A force-blocking dashboard refresh succeeded for all eight tiles and reflected
  the new installation, lifecycle outcomes, and exception volume. Project IP
  anonymization remained on and session replay remained off.

## Dashboard usage expansion

On 2026-07-16, six additional saved insights were added to `CLI Product Health`
without changing the CLI or injecting synthetic product usage:

- `Product installs — unique setups` (`k8VzDYDm`) counts literal anonymous
  installation UUIDs (`distinct_id`) after a successful telemetry-enabled
  `setup` command since launch.
- `New setup installations by day` (`6wi4W6Bd`) assigns each installation UUID to
  its first successful setup day so rerunning setup does not inflate the trend.
- `Search and show usage per installation (30d)` (`XaEAPnLX`) reports runs,
  unique adopting installations, and runs per adopting installation.
- `Search and show usage trend (30d)` (`rcTZtKw8`) reports daily search/show runs
  alongside the unique installation count for each command.
- `Top CLI commands by usage (30d)` (`gGKrxEmH`) compares total runs with unique
  installation adoption across all controlled public commands.
- `Anonymous installation usage (30d)` (`Ip1E0ddy`) lists the stable anonymous
  UUID with command, search, and show counts plus first/last seen timestamps. It
  includes no name, email, path, prompt, repository, or transcript data.

The dashboard now has 14 tiles ordered from installs and activity through command
usage, lifecycle reliability, exceptions, and platform distribution. Every new
query was executed independently, and a final force-blocking refresh succeeded
for all 14 tiles. Later exact-wheel QA populated these views with one real setup,
four searches, one show, and real lifecycle/error events from disposable installs.

## Diligent review hardening

On 2026-07-16, five review findings were checked against the intended design and
accepted because each exposed a real privacy, consent, boundary, ledger, or
analytics gap:

- Exception capture is now structural and non-throwing. It never calls
  `str(error)` or sends free-form error text.
- Lifecycle telemetry runs only for the first durable non-terminal-to-terminal
  transition. An opted-out transition cannot be replayed after re-enabling.
- PostHog `before_send` rebuilds properties from the typed event's exact key set,
  so new SDK context fields cannot bypass the allowlist.
- Failed runs persist their controlled failure category in the run ledger;
  telemetry reads the durable result instead of receiving telemetry-only state.
- Foreground commands returning exit code `130`, including the real `jobs attach`
  detachment path, are recorded as interrupted rather than failed.

The branch also merged current `origin/main`; the dependency resolution keeps
both main's `filelock` requirement and telemetry's PostHog requirement.

Local review-fix verification passed 547 tests on Python 3.12.10 and Python
3.13.3, Ruff, `git diff --check`, and `codealmanac validate` over 71 pages. A
real PostHog 7.25 client with its network submitter mocked proved that the final
SDK payload contains exactly the validated event properties; a separate
red/green test proves a failing property rebuild drops the event rather than
letting the SDK send its unmodified context. The final wheel built, installed in
an isolated Python 3.12 environment, and passed version, config, and dependency
smokes with telemetry disabled.

PR #36 became mergeable after the main merge. GitHub's package check and both
test jobs passed for review-fix commit `463de759`.

## Follow-up review hardening

On 2026-07-16, two follow-up findings were reproduced and accepted with narrower
architectural choices than the suggested implementations:

- A telemetry-only `read_spec` failure could escape after a terminal transition
  had committed. `RunsService` now wraps the complete supporting read and capture
  path, and `TelemetryService` also contains lifecycle shaping failures. The run
  spec was deliberately not added to transition results because cancellation
  results reach public JSON and specs contain source inputs and guidance.
- Broad exception and traceback matching confused harness readiness, provider
  execution, source preparation, indexing, and wiki validation. Failure writes
  now receive the explicit workflow phase. `HarnessUnavailable` distinguishes a
  failed readiness check, and `source_preparation` records ingest resolution and
  runtime-inspection failures.

Focused regression, workflow, architecture, and telemetry verification passed
133 tests. The full suite passed 554 tests on Python 3.12.10 and Python 3.13.3,
along with Ruff, `git diff --check`, and `codealmanac validate` over 71 pages.
The wheel built, installed into an isolated Python 3.12 environment, and passed
version, config, and `source_preparation` enum smokes with telemetry disabled.

GitHub's package check and both test jobs passed for follow-up review-fix commit
`438d789b`; PR #36 remained mergeable.

## Completion state

The original implementation, disposable smoke testing, privacy audit, PostHog
dashboard, and diligent-review fixes are on `codex/cli-telemetry`. The third
review fixes have passed full local, package, and GitHub verification. PR #36
remains draft and mergeable. Unrelated user files remain untouched and
untracked.

## Third review hardening

On 2026-07-16, three further findings were reproduced and accepted with bounded
architectural fixes:

- Lifecycle telemetry now rejects unknown or harness-incompatible model values
  against the central catalog. Validation stays at the outbound typed boundary,
  not in durable `RunSpec`, so historical queued records remain readable.
- `OperationRunner.fail` computes a non-throwing summary and independently
  best-efforts the readable error event and authoritative failed transition. An
  event-store failure can no longer leave a run durably running or replace its
  phase category.
- `HarnessesService.ensure_ready` and `run_ready` make workflow phase explicit.
  Adapter exceptions are `provider_execution` after readiness, while a typed
  caller event-sink failure remains `internal_error`.

The implementation plan is
`docs/plans/2026-07-16-cli-telemetry-third-review-fixes.md`. Focused telemetry,
workflow, and harness verification passed 71 tests. The full suite passed 562
tests on Python 3.12.10 and Python 3.13.3, along with Ruff, `git diff --check`,
and `codealmanac validate` over 71 pages. A clean wheel build omitted stale
ignored build output, installed into an isolated Python 3.12 environment, and
passed version, config, and unknown-model privacy-boundary smokes with telemetry
disabled. GitHub's package check and both test jobs passed for implementation
commit `fc48144b`; PR #36 remained mergeable.

## Final documentation review

A final P3 review found one shipped manual example that still named the retired
combined `harnesses.run(...)` call. `src/codealmanac/manual/how-to-write.md` now
teaches the explicit `ensure_ready(...)` then `run_ready(...)` stages used by
`OperationRunner`; no runtime behavior changed.

## Latest-main reconciliation

PR #36 was rebased onto `origin/main` at `c594aec1`, which includes the macOS
background-item setup work from `59ccd345`. The setup conflicts preserve both
features: every choice screen uses the dynamic six-or-seven-step denominator,
the Product updates screen renders the selected background-item notice, and
telemetry remains the optional final screen. Notice construction lives with the
other background-item render policy instead of making `setup_tui.py` oversized.

The combined interactive setup regression verifies `[1/7]` through `[7/7]`,
runner/model/instructions ordering, the telemetry choice, and the selected
background-item notice in one journey. Rebase verification passed all 564 tests
on Python 3.12.10 and Python 3.13.3, Ruff, `git diff --check`, and
`codealmanac validate` over 71 pages. A tree comparison against the previous PR
head plus latest main found no runtime drift.

## Final rebased end-to-end certification

On 2026-07-16, initial rebased head `056d2853` was built as a clean `0.4.6` wheel and
installed into a new Python 3.12 virtualenv. All product state and repositories
used disposable directories; the real user registry, schedules, configuration,
and unrelated worktree files were untouched.

- A clean `setup --yes` saved telemetry on, installed isolated Codex
  instructions, and created one stable UUID,
  `ca8a7992-044a-4a50-aa5d-8898322aabe5`. Help, version, and setup help created
  no pre-consent state.
- A real pseudo-terminal setup traversed provider, model, agent instructions,
  maintenance, product updates, change handling, and telemetry as steps one
  through seven. The final screen displayed both the recommended Yes/privacy
  copy and functional No. Selecting No saved `telemetry.enabled = false` and
  created no identity table.
- The installed wheel ran real logged-in Codex build, ingest, and garden jobs to
  durable `done`; their PostHog lifecycle events arrived as `build/done`,
  `ingest/done`, and `garden/done`. A queued garden cancellation emitted exactly
  one `garden/cancelled` event across two cancel attempts.
- The disposable wiki passed validation and supported real health, list, topics,
  search, and show reads. Parser-to-event validation covered all 38 public
  command/action combinations; hidden worker/executor/scheduler commands remain
  excluded from product-command events.
- A background worker spawn failure reached durable `failed` with
  `internal_error`, produced one lifecycle event, and created/updated PostHog
  issue `019f69e3-9563-7a81-81cf-e630049ea96a`. A real foreground search crash
  produced `outcome=crashed` plus issue
  `019f6ca2-0ca4-7321-aab9-a787023a16ae`. Both sampled issues contain only the
  exception type/fingerprint and CodeAlmanac module/function/line frames.
- Across the 155 exact-UUID events inspected, forbidden query, path, repository,
  run, prompt, transcript, provider-session, name, email, username, URL, session,
  IP, and SDK context properties all counted zero. Private query and worker-error
  test markers also counted zero. Every inspected person was anonymous and had
  no name, email, or username.
- Twenty simultaneous first-use commands produced 20 events under one UUID and
  one anonymous person. A dead-proxy command returned success in 0.454 seconds
  and produced no event. `CODEALMANAC_NO_TELEMETRY`, `DO_NOT_TRACK`, and `CI`
  each suppressed state creation. An opted-out terminal transition was not
  replayed after re-enabling.
- Corrupt identity data did not affect a valid command. A deliberately broken
  telemetry-delivery table did not prevent a separate run from committing
  `done`. These failures remained telemetry-only.
- The dashboard install queries were corrected to count/group literal
  installation UUID `distinct_id` values rather than relying on current
  one-to-one PostHog person IDs. A fresh force-blocking run succeeded for all 14
  tiles: installs reported one setup; search/show reported 4/1 runs across 2/1
  installations; lifecycle outcomes included the real done, cancelled, and
  failed journeys; exception volume included both foreground and background
  failures; the per-installation table showed the primary UUID with 125 commands,
  three searches, and one show.
- The exact wheel declares compatible dependencies, passes `uv pip check`,
  contains the public ingestion token but no personal API-key pattern, and omits
  stale build modules. GitHub's package check and both Python test jobs passed on
  the exact rebased head; PR #36 was draft, mergeable, and based on current main.

While final QA was running, main advanced once more to `d2b8b8f8` with shipped
agent-guide citation text and its test. The branch rebased cleanly with no
conflicts; comparison with the first certified tree showed only those three main
files changed and no telemetry/runtime drift. Runtime head `94147e47` then passed
all 564 tests on Python 3.12.10 and Python 3.13.3, Ruff, 71-page Almanac
validation, `git diff --check`, clean sdist/wheel construction, fresh Python 3.12
installation, and dependency checking. A command from that exact wheel arrived
in PostHog under disposable UUID `162293b9-5f93-43dc-80a0-80021ab87b43` as
`config/list/success` on version `0.4.6`, with GeoIP disabled and no SDK library,
IP, or query property. Its person remained anonymous with no name, email, or
username. A final force-blocking dashboard run returned all 14 insights without
error: one product install, ten active installations, four searches across two
installations, one show, the expected lifecycle outcome rows, and six sanitized
exceptions affecting four disposable installations.

## Lockfile hygiene review

A final P3 review correctly identified that the telemetry branch had retained a
revision-2 lockfile generated by local `uv 0.6.16`, while current main uses
revision 3. The raw `uv.lock` diff was 568 additions and 509 deletions even
though its normalized dependency change was only PostHog and four transitive
packages.

Modern `uv` preserves an existing compatible lock revision, so rerunning it on
the branch's revision-2 file was insufficient. The lock was mechanically seeded
from current main and regenerated with `uv 0.11.29`. The resulting revision-3
lock keeps `upload-time` metadata and differs from main by exactly 59 additions,
with no deletions: `posthog`, `backoff`, `distro`, `requests`, `urllib3`, and the
two CodeAlmanac PostHog dependency edges.

Both modern and repository-local `uv lock --check` pass. Modern locked sync
dry-run and local `uv sync --locked` make no changes. The exact lock passes all
564 tests on Python 3.12.10 and Python 3.13.3, Ruff, 71-page Almanac validation,
`git diff --check`, and a clean modern-uv sdist/wheel build. No project-wide uv
pin was added because that is a separate tooling-policy decision; the review
noise is removed without broadening this telemetry fix.
