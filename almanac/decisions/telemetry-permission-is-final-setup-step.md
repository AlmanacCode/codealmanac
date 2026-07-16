---
title: Telemetry Permission Is Final Setup Step
topics: [decisions, setup, config, product, telemetry]
sources:
  - id: telemetry-plan-transcript
    type: conversation
    path: /Users/divitsheth/.codex/sessions/2026/07/15/rollout-2026-07-15T15-13-22-019f67d7-7966-7571-b190-551f5db09c4a.jsonl
    note: Conversation that settled the setup order and telemetry permission requirements.
  - id: setup-tui
    type: file
    path: src/codealmanac/cli/dispatch/setup_tui.py
    note: Current interactive setup ordering and default-selection behavior.
  - id: setup-selections
    type: file
    path: src/codealmanac/cli/dispatch/setup_wizard/models.py
    note: Current setup selection model.
  - id: config-models
    type: file
    path: src/codealmanac/services/config/models.py
    note: Current supported config keys and user config model.
  - id: telemetry-service
    type: file
    path: src/codealmanac/services/telemetry/service.py
    note: Runtime telemetry opt-out policy, event construction, and exception redaction.
  - id: telemetry-store
    type: file
    path: src/codealmanac/services/telemetry/store.py
    note: Local SQLite installation UUID and once-only event claim storage.
  - id: telemetry-sender
    type: file
    path: src/codealmanac/integrations/telemetry/sender.py
    note: Detached PostHog sender and delivery privacy settings.
---

# Telemetry Permission Is Final Setup Step

Telemetry permission is the final setup decision. The user first chooses the runner, model, instruction installation, wiki maintenance, product updates, and change-handling policy; the seventh screen then asks about anonymous usage and error telemetry [@telemetry-plan-transcript] [@setup-tui] [@setup-selections] [@config-models].

## Status

Implemented. `telemetry.enabled` is part of user config and the seven-step setup flow; `--no-telemetry` is the explicit non-interactive opt-out [@config-models] [@setup-tui].

## Context

Setup already asks several consent-like questions: where to install agent instructions, which local harness and model should run lifecycle jobs, whether wiki maintenance and product updates should be automated, and whether agents may commit wiki changes [@setup-tui]. The telemetry prompt is different because it asks permission to send anonymous usage information outside the machine. It therefore belongs after the user understands the local automation choices, not before them [@telemetry-plan-transcript].

Telemetry is separate from product content. It helps prioritize improvements and identify broken flows while excluding code, paths, prompts, transcripts, command arguments, queries, repository/run identifiers, locals, and code variables. Real unhandled exceptions may include only a bounded redacted message and sanitized CodeAlmanac stack shape [@telemetry-plan-transcript].

## Decision

The intended interactive setup order is:

1. AI provider.
2. Provider model.
3. Add instructions to `AGENTS.md` or `CLAUDE.md`.
4. Wiki maintenance.
5. Product updates.
6. Change handling.
7. Telemetry permission.

The telemetry screen should default to "Yes" and mark that option Recommended, while keeping a visible and functional "No thanks" option [@telemetry-plan-transcript]. The screen copy should explain that sharing anonymous usage helps focus improvements and fix broken experiences faster. Code, paths, prompts, transcripts, and raw error text are never collected; crash reports contain only the bounded, locally sanitized exception shape above [@telemetry-plan-transcript].

Non-interactive setup follows the same policy. `setup --yes` accepts the saved/default Yes, while `setup --no-telemetry` persists No. There is no separate first-run notice mechanism [@telemetry-plan-transcript].

## Consequences

Telemetry state belongs in user config as `telemetry.enabled`, and the public config surface lets users later run `codealmanac config set telemetry.enabled false` [@config-models]. The setup selection model carries `telemetry_enabled` beside targets, harness, model, update, commit, sync, and Garden settings, so telemetry follows the same shaped setup path as other persisted choices [@setup-selections].

The runtime uses a stable random installation UUID in local SQLite, a typed telemetry service, and a detached PostHog sender [@telemetry-store] [@telemetry-service] [@telemetry-sender]. GeoIP and code-variable capture are disabled [@telemetry-sender]. For the event and delivery boundary, see [Telemetry](../architecture/telemetry).
