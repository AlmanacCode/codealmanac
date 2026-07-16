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
- Base: latest `origin/main` at `7ebc8c85`
- Plan commit: `a40ef638`
- Onboarding/config commit: `f64c893d`
- Almanac architecture commit: `4e8e9661`
- Telemetry implementation/test commit: `8c193253`
- Exact production QA documentation commit: `d80b1aee`
- Linux CI test-isolation fix: `4edfe89a`
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
  exceptions. Strip paths, credentials, tokens, locals, code variables, and
  source context.
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
- Redacted, bounded exception envelope with CodeAlmanac-only module/function/line
  frames and stable fingerprint.
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

- `Product installs — unique setups` (`k8VzDYDm`) counts unique PostHog persons,
  which map one-to-one to installation UUIDs, after a successful telemetry-enabled
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
for all 14 tiles. At verification time setup/search/show views were empty because
the project contained only deliberate config/validate smoke events; no fake usage
was added, and these views will populate from real telemetry-enabled installations.

## Completion state

Implementation, review, disposable smoke testing, package verification, privacy
audit, and PostHog dashboard work are complete. The feature remains isolated on
`codex/cli-telemetry`; unrelated user files remain untouched and untracked.
