# CLI Telemetry Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add privacy-conscious PostHog telemetry that shows how the CLI is used, with a strongly recommended but genuine opt-out as the final onboarding choice.

**Architecture:** A typed telemetry service owns policy, identity selection, and event construction; a local SQLite store owns the anonymous installation identity; and a PostHog adapter sends allowlisted events from a detached child process. The setup wizard collects `telemetry.enabled` with the other user preferences; CLI and run services emit events without knowing PostHog details. A typed `TelemetryIdentity` seam keeps a future login additive: anonymous events use the installation UUID today, while a later auth service can supply an opaque account ID and link the earlier anonymous history.

**Tech Stack:** Python 3.12, Pydantic, SQLite, PostHog Python SDK, argparse, pytest.

---

## Product decisions

- Use a fresh US PostHog project named `CodeAlmanac CLI`. Do not reuse the existing CodeAlmanac project.
- Telemetry is enabled by default. Interactive onboarding presents a real Yes/No choice, with Yes selected and marked recommended.
- `codealmanac setup --yes` keeps telemetry enabled without another prompt.
- `codealmanac setup --yes --no-telemetry` provides a non-interactive opt-out.
- Users can change the choice later with `codealmanac config set telemetry.enabled true|false`.
- There is no separate first-run notice, notice timestamp, delayed activation, or notice fallback.
- A previous opt-out is preserved when setup is rerun unless the user explicitly changes the telemetry choice.
- Telemetry is best effort. It must never change command output, exit status, or application behavior.
- Preserve a future login path. PostHog-specific identity selection must not leak into CLI dispatch, run services, or event models.
- Create a PostHog person profile for each installation UUID. Until login exists, that profile contains no name, email, provider identity, or other personal property.

## Onboarding contract

The interactive setup sequence is exactly:

1. AI provider
2. Provider model
3. Add CodeAlmanac instructions to `AGENTS.md` / `CLAUDE.md`
4. Wiki maintenance
5. Product updates
6. Agent change handling
7. Telemetry permission

The final screen uses this product shape:

```text
[7/7] Help improve CodeAlmanac

Share anonymous usage so we can focus on what matters and fix broken
experiences faster.

╭──────────────────────────────────╮   ╭──────────────────────────────────╮
│ Yes, help improve CodeAlmanac    │   │ No thanks                        │
│ Recommended                      │   │ Do not share anonymous usage     │
│                                  │   │                                  │
│ Never code, prompts, transcripts,│   │ You can change this later in     │
│ CLI arguments, or local data.    │   │ CodeAlmanac config.              │
╰──────────────────────────────────╯   ╰──────────────────────────────────╯
```

The presentation may make Yes visually prominent through initial selection, the `Recommended` label, and benefit-led copy. Both options remain visible, accurate, and equally operable.

## Data contract

Persist one random installation UUID in `~/.codealmanac/codealmanac.db`. Never derive it from the user, machine, home directory, repository, or provider account.

Represent capture identity with a typed boundary:

```python
class TelemetryIdentity(CodeAlmanacModel):
    installation_id: UUID
    distinct_id: str
    kind: Literal["anonymous", "authenticated"]
```

For v1, `distinct_id` is the installation UUID and `kind` is `anonymous`. The telemetry service resolves this identity and passes it to the sender; the PostHog adapter never decides who the event belongs to.

Future login extends the same boundary without replacing telemetry:

1. Before login, capture with the anonymous installation UUID.
2. On first login, link that UUID to the account's opaque internal user ID with a PostHog identity/alias event.
3. After login, capture with the opaque user ID while retaining `installation_id` for installation-level analysis.
4. On logout or account switching, rotate the anonymous distinct ID before capturing unauthenticated activity so different accounts on one machine are not merged.

Do not use email, name, provider account ID, or another directly identifying value as the PostHog distinct ID. The future authentication service owns the canonical opaque user ID. Identity linking remains subject to `telemetry.enabled`; opting out suppresses capture and linking alike.

Usage events create and update the UUID-backed installation profile. PostHog GeoIP enrichment remains disabled. PostHog Error Tracking is enabled for unhandled CLI, worker, and executor crashes; code-variable/local-variable capture remains disabled.

### `cli command completed`

Allow only:

- `command`: top-level public command
- `action`: controlled canonical action, never an argument or user-provided value
- `outcome`: `succeeded`, `failed`, `crashed`, or `interrupted`
- `exit_code`
- `duration_bucket`: `<250ms`, `250ms-1s`, `1-10s`, `10-60s`, `1-5m`, or `5m+`
- `cli_version`
- `os_family` and `os_major`
- `architecture`
- `python_version`: major and minor only
- `interactive`

Capture all public top-level commands: `init`, `ingest`, `garden`, `sync`, `list`, `search`, `show`, `topics`, `health`, `validate`, `reindex`, `serve`, `tag`, `untag`, `config`, `setup`, `uninstall`, `doctor`, `update`, `jobs`, and `automation`.

For commands with meaningful controlled branches, normalize `action` as follows:

- `sync`: `run` or `status`
- `topics`: `list`, `show`, `create`, `describe`, `link`, `unlink`, `rename`, or `delete`
- `config`: `list`, `get`, `set`, or `apply`
- `jobs`: `list`, `show`, `logs`, `attach`, or `cancel`
- `automation`: `status`
- `update`: `run`, `check`, or `scheduled`
- Commands without a subcommand use their command name as the action.

Do not emit command events for hidden `__*` commands, parser syntax failures, help, or version output. Normalize the `ca` and `codealmanac` entrypoints to the same command/action values. For `setup`, evaluate the saved choice after setup completes so choosing No does not emit the setup event. Do not derive `action` from positional arguments, free-form values, page selectors, search queries, or uncontrolled flags.

### PostHog `$exception`

Capture unhandled exceptions at the outer CLI, worker, and executor boundaries before preserving the existing failure behavior. Allow only:

- Exception type
- Redacted and length-bounded exception message
- Sanitized stack frames with CodeAlmanac module/function/line information
- Stable error fingerprint
- Top-level command or hidden process kind
- CLI version, OS family, architecture, and Python major/minor

Replace home directories, repository paths, temporary paths, URLs containing credentials, tokens, and command arguments before the payload reaches the sender. Do not capture frame locals, code variables, environment variables, request/input objects, raw CLI arguments, source files from the user's repository, or handled product errors. Telemetry opt-out suppresses exception capture too.

### `lifecycle run completed`

Allow only:

- `run_kind`: `build`, `ingest`, or `garden`
- `status`: `done`, `failed`, or `cancelled`
- `failure_category`: present only for failed runs; one of `harness_readiness`, `provider_execution`, `mutation_safety`, `wiki_validation`, `indexing`, or `internal_error`
- `harness`: controlled harness kind
- `model`: controlled configured model
- `duration_bucket`
- `cli_version`

Emit once when a run first enters a terminal state. Idempotent finish or cancellation calls must not duplicate the event. A normal provider or validation failure emits the failed lifecycle event without inventing an exception. When a real Python exception caused the failure, emit both the lifecycle event and a PostHog `$exception`.

### Prohibited data

Never send raw CLI arguments, source code, unsanitized paths, repository names or IDs, run IDs, page titles, prompts, transcripts, guidance, handled product-error text, Git data, provider session IDs, IP-derived properties, tokens, environment variables, frame locals, or arbitrary free-form properties. The only exception text allowed is the bounded, redacted unhandled-crash message and sanitized stack shape defined above.

## Task 1: Record the product exception

**Files:**

- Modify: `docs/python-port-live-agreement.md`
- Modify: `almanac/decisions/local-only-python-product.md`
- Modify: `almanac/architecture/setup/README.md`

1. Add a dated agreement that anonymous product telemetry is the only remote product exception.
2. State that lifecycle work, wiki content, transcripts, and repository data remain local.
3. Replace claims that the product performs no telemetry or cloud capture with the narrower accurate contract.
4. Run `codealmanac validate` and confirm the wiki remains valid.

## Task 2: Add the telemetry configuration contract

**Files:**

- Modify: `src/codealmanac/services/config/models.py`
- Modify: `src/codealmanac/services/config/requests.py`
- Modify: `src/codealmanac/services/config/service.py`
- Test: `tests/test_config_service.py`

1. Write failing tests for `telemetry.enabled`, config list/get/set, invalid boolean values, and full setup updates preserving the field.
2. Add `TelemetryConfig(enabled: bool = True)` to `UserConfig` and `ConfigKey.TELEMETRY_ENABLED = "telemetry.enabled"`.
3. Add `telemetry` to `UpdateUserConfigRequest`, config entries, scalar updates, and TOML updates.
4. Run the focused tests and confirm they pass.

## Task 3: Reorder onboarding and add permission

**Files:**

- Modify: `src/codealmanac/cli/dispatch/setup_wizard/models.py`
- Modify: `src/codealmanac/cli/dispatch/setup_wizard/options.py`
- Modify: `src/codealmanac/cli/dispatch/setup_tui.py`
- Modify: `src/codealmanac/cli/render/setup/screens.py`
- Modify: `src/codealmanac/cli/parser/setup.py`
- Modify: `src/codealmanac/cli/dispatch/setup.py`
- Modify: `src/codealmanac/services/setup/requests.py`
- Modify: `src/codealmanac/services/setup/service.py`
- Test: `tests/test_cli.py`
- Test: `tests/test_setup_service.py`

1. Write failing tests that capture the exact seven-screen order and telemetry choices.
2. Move provider and model to steps 1 and 2; move the agent-instructions target screen to step 3.
3. Change the renderer’s progress total from six to seven.
4. Add the final telemetry options with Yes first, initially selected for a new user, and `Recommended` in its copy.
5. Add `telemetry_enabled` to `SetupSelections` and `RunSetupRequest`, then persist it through `SetupService`.
6. Add `--no-telemetry`. It forces false and suppresses the telemetry screen when supplied explicitly.
7. Keep `--yes` and `--json` non-interactive. They use the current saved choice, which is true for a new user; `--no-telemetry` overrides it.
8. Verify that rerunning setup preserves an existing false choice unless the interactive screen or flag explicitly changes it.

## Task 4: Add typed telemetry state and policy

**Files:**

- Create: `src/codealmanac/services/telemetry/models.py`
- Create: `src/codealmanac/services/telemetry/ports.py`
- Create: `src/codealmanac/services/telemetry/service.py`
- Create: `src/codealmanac/services/telemetry/store.py`
- Test: `tests/test_telemetry_service.py`

1. Write failing tests for a stable random installation UUID, typed anonymous identity, strict event models, disabled capture, and swallowed sender failures.
2. Store the singleton installation UUID in the local SQLite database using a telemetry-owned table.
3. Define `TelemetryIdentity`, a `TelemetrySender` port that receives the resolved identity, and closed Pydantic event models. Do not expose a loose property dictionary at the service boundary.
4. Make the service own identity resolution and reload user config at capture time so an opt-out takes effect immediately. Leave identity linking as a future additive service verb; do not implement login or emit alias events in v1.
5. Disable capture when `telemetry.enabled` is false, `CODEALMANAC_NO_TELEMETRY` is truthy, `DO_NOT_TRACK` is truthy, or CI is detected.
6. Ensure telemetry policy and sender failures never escape into the product command.

## Task 5: Add the detached PostHog adapter

**Files:**

- Create: `src/codealmanac/integrations/telemetry/posthog.py`
- Create: `src/codealmanac/integrations/telemetry/sender.py`
- Modify: `pyproject.toml`
- Modify: `uv.lock`
- Test: `tests/test_posthog_telemetry.py`

1. Write failing tests for the detached command, serialized allowlisted envelopes, exception redaction, and child PostHog client settings.
2. Add the supported PostHog Python SDK dependency.
3. Spawn a one-shot child with a new session, closed file descriptors, and stdout/stderr redirected to null. The parent must not wait or communicate after handing off the bounded payload.
4. In the child, validate the typed payload, allow person-profile processing for the installation UUID, disable GeoIP, submit exception envelopes to PostHog Error Tracking, send once, shut down, and suppress every failure.
5. Keep PostHog code-variable/local-variable capture disabled. The parent process supplies the already-sanitized traceback; the detached sender must not inspect its own frames or environment.
6. Do not add an outbox or retry queue in v1.
7. Package only the fresh project’s public ingestion token; never ship a PostHog personal API key.

## Task 6: Wire command and lifecycle events

**Files:**

- Modify: `src/codealmanac/app.py`
- Modify: `src/codealmanac/cli/main.py`
- Modify: `src/codealmanac/services/runs/service.py`
- Test: `tests/test_cli.py`
- Test: `tests/test_runs_service.py`

1. Write failing tests with a fake sender for successful, failed, crashed, and interrupted commands, safe canonical actions, plus a separate sanitized exception envelope for unhandled crashes.
2. Add telemetry to `AppAdapters`, `Services`, and `CodeAlmanac`; wire the real adapter only in the composition root.
3. Time and classify public command completion without changing existing exception handling, output, or exit codes. Derive `command` and `action` only from parser-owned finite choices. Capture unhandled exceptions at the outer CLI boundary, send them best effort, and re-raise unchanged.
4. Re-read configuration after `setup` and `config set` before deciding whether to emit their command event.
5. Write failing tests for done, failed, and cancelled run transitions, controlled failure-category mapping, exception-backed failures, and idempotent repeats.
6. Emit lifecycle completion only after a durable non-terminal-to-terminal transition. Read the durable run spec for controlled harness/model properties and map failures to the finite category enum without sending the stored error text.
7. Install equivalent unhandled-exception boundaries for detached worker and executor entrypoints so background crashes appear in PostHog Error Tracking without exposing run or repository identity.

## Task 7: Document privacy and opt-out

**Files:**

- Modify: `README.md`
- Modify: `almanac/reference/config-keys.md`
- Modify: `almanac/guides/setup-local-automation.md`
- Modify: `almanac/guides/demo-codealmanac-in-launch-video.md`

1. Add a concise Telemetry section explaining the benefit, exact collected fields, redacted crash reporting, prohibited data, and PostHog destination.
2. Document interactive No, `setup --yes --no-telemetry`, config opt-out, and environment opt-outs.
3. Remove public claims that CodeAlmanac performs no telemetry at all.
4. Do not describe a first-run notice because none exists.

## Task 8: Configure PostHog and verify release behavior

1. Create the fresh US `CodeAlmanac CLI` project.
2. Enable project-level IP anonymization before any dogfood event. Leave default event retention unchanged.
3. Enable UUID-backed person profiles and PostHog Error Tracking. Keep GeoIP enrichment, session replay, and code-variable capture disabled; do not attach environment variables or local state to exceptions. Confirm installation profiles contain no name or email.
4. Create a `CLI Product Health` dashboard covering active installations, retention, command/action adoption, activation, command success, lifecycle success by failure category, exception volume, and version/platform distribution.
5. Run `uv run pytest`, `uv run ruff check .`, and `codealmanac validate`.
6. Build and install the wheel under a temporary `HOME`. Verify interactive Yes, interactive No, `--yes`, `--yes --no-telemetry`, and later config opt-out.
7. Inspect PostHog live events, installation profiles, and exception issues. Confirm usage events contain only allowlisted fields, profiles contain only the random UUID and controlled installation properties, exceptions contain sanitized frames without locals or user paths, and no name, email, or IP-derived property appears.

## Acceptance criteria

- The setup wizard follows the exact seven-step order above.
- Yes is persuasive, recommended, initially selected, and truthful; No is visible and works.
- `--yes` enables telemetry by default and `--no-telemetry` overrides it.
- There is no notice or delayed-activation machinery.
- Opt-out takes effect before the current command can emit telemetry.
- Every public command is measured with a parser-owned canonical action; arguments, queries, identifiers, and user values never become analytics properties.
- No command or run content can enter the typed event envelope.
- Failed lifecycle runs include a controlled failure category, and only genuine Python exceptions create Error Tracking issues.
- Unhandled foreground and background crashes reach PostHog Error Tracking with useful sanitized stack traces and no frame locals, secrets, or user repository data.
- Identity is resolved through `TelemetryIdentity`; future login can link the anonymous UUID to an opaque user ID without changing command or lifecycle instrumentation.
- Network failure cannot alter CLI output, latency-sensitive execution, or exit status.
- The PostHog dashboard answers whether people activate, return, use major commands, and complete lifecycle work successfully.
