---
title: Telemetry
topics: [architecture, telemetry, config, local-state]
sources:
  - id: live-agreement
    type: file
    path: docs/python-port-live-agreement.md
    note: Current product boundary and telemetry exception.
  - id: app-root
    type: file
    path: src/codealmanac/app.py
    note: Composition root wiring for telemetry service, identity store, and sender.
  - id: telemetry-service
    type: file
    path: src/codealmanac/services/telemetry/service.py
    note: Telemetry capture policy, opt-out checks, and structural event construction.
  - id: telemetry-models
    type: file
    path: src/codealmanac/services/telemetry/models.py
    note: Allowlisted telemetry event names and properties.
  - id: telemetry-store
    type: file
    path: src/codealmanac/services/telemetry/store.py
    note: Local SQLite identity and once-only event claim storage.
  - id: telemetry-sender
    type: file
    path: src/codealmanac/integrations/telemetry/sender.py
    note: Detached PostHog sender and delivery-time privacy controls.
  - id: cli-execution
    type: file
    path: src/codealmanac/cli/execution.py
    note: CLI command and exception telemetry entrypoint.
  - id: runs-service
    type: file
    path: src/codealmanac/services/runs/service.py
    note: Lifecycle terminal event capture.
  - id: run-worker
    type: file
    path: src/codealmanac/workflows/run_queue/worker.py
    note: Worker-side exception capture for failed queued execution.
  - id: telemetry-tests
    type: file
    path: tests/test_telemetry_service.py
    note: Tests for identity, opt-out, allowlisted properties, once-only capture, and exception privacy.
  - id: sender-tests
    type: file
    path: tests/test_telemetry_sender.py
    note: Tests for detached sender behavior, PostHog settings, and bounded payloads.
  - id: run-telemetry-tests
    type: file
    path: tests/test_run_telemetry.py
    note: Tests for lifecycle telemetry privacy and failure categories.
---

# Telemetry

Telemetry is CodeAlmanac's narrow remote product-signal layer. The product is still local-first: wiki source, source code, prompts, transcripts, repository identifiers, run identifiers, paths, command arguments, and exception messages stay on the machine, while telemetry may send only allowlisted command outcomes, lifecycle outcomes, and structural unhandled exception shapes [@live-agreement] [@telemetry-models].

The service boundary is split like the rest of the application. `TelemetryService` owns product policy and event construction; `TelemetryIdentityStore` owns the local SQLite identity and once-only event claims; `SubprocessTelemetrySender` owns PostHog delivery as an integration detail [@telemetry-service] [@telemetry-store] [@telemetry-sender]. The [Composition root](composition-root) wires those pieces into the app graph, so CLI commands, run services, and workers use the same service instead of importing PostHog or sender code directly [@app-root].

## Policy And Identity

`telemetry.enabled` is the user config switch. `CODEALMANAC_NO_TELEMETRY`, `DO_NOT_TRACK`, and `CI` disable capture before config is consulted, and the service reloads config policy for each event unless it has intentionally frozen policy before local-state removal [@telemetry-service]. The config surface is documented in [Config keys](../reference/config-keys), and setup consent is fixed by [Telemetry permission is final setup step](../decisions/telemetry-permission-is-final-setup-step).

The identity is a random UUID stored in local SQLite, not a TOML field. `TelemetryIdentityStore.get_or_create` stores one `telemetry_installation` row and returns an anonymous identity whose `distinct_id` is the UUID string [@telemetry-store]. Terminal lifecycle capture happens only on the first durable non-terminal-to-terminal transition; `claim_event` stores event keys in `telemetry_delivery` as an additional duplicate-delivery guard [@telemetry-store] [@telemetry-tests]. A transition completed while opted out is therefore never replayed if telemetry is later re-enabled.

## Event Surface

The allowlist lives in `TelemetryEvent.only_allow_event_properties`. The supported event names are `cli command completed`, `lifecycle run completed`, and `$exception`; each has a fixed property set plus common environment fields such as CLI version, identity kind, OS family, OS major version, architecture, Python major/minor version, and `$geoip_disable` [@telemetry-models] [@telemetry-service].

CLI execution captures command completion and unhandled exceptions through the telemetry service [@cli-execution]. `RunsService` captures the first lifecycle terminal transition through `capture_lifecycle`, using run kind, status, harness, model, duration bucket, and the controlled failure category persisted on failed run records [@runs-service] [@telemetry-service]. The typed lifecycle model validates the harness/model pair against the central controlled catalog and drops the event if the value is unknown or incompatible; arbitrary historical run-spec text can therefore remain locally readable without becoming outbound data. The terminal-telemetry helper treats both the supporting run-spec read and event shaping as best effort, so neither can make an already-committed transition appear to fail. The run queue worker also captures structural exceptions when worker execution fails before normal run completion can handle the failure [@run-worker].

Lifecycle failure categories are workflow facts, not telemetry guesses. The operation runner persists the explicit phase that failed, including harness readiness, provider execution, source preparation, indexing, wiki validation, and internal machinery; telemetry only projects that durable category [@runs-service] [@telemetry-service].

Exception capture never calls `str(error)` or sends an exception message. It keeps only the exception type, CodeAlmanac module/function/line frames, and a stable fingerprint derived from that structural data; shaping is fail-closed so a telemetry error cannot replace the product exception [@telemetry-service]. Tests assert that arbitrary private error text, source paths, run IDs, provider output, and unknown properties do not leave the process [@telemetry-tests] [@run-telemetry-tests].

## Delivery Boundary

The default sender serializes the shaped event and starts a detached `python -m codealmanac.integrations.telemetry.sender` subprocess with stdout and stderr discarded [@telemetry-sender]. Delivery is best-effort: oversized payloads are dropped, sender exceptions do not change product behavior, and importing the parent sender does not import the PostHog SDK [@telemetry-service] [@telemetry-sender] [@sender-tests].

The delivery process uses PostHog's US ingestion host with sync delivery, a five-second timeout, GeoIP disabled, exception autocapture disabled, code-variable capture disabled, and a `before_send` hook that rebuilds the outbound property map from the exact keys validated on the typed event [@telemetry-sender]. This positive allowlist prevents future SDK-added context from crossing the boundary; if rebuilding ever fails, the hook drops the event because the SDK otherwise falls back to sending the unmodified payload. The event UUID is passed as PostHog's `uuid`, and the anonymous installation UUID is the distinct ID [@telemetry-sender] [@sender-tests].

This architecture keeps the remote exception explicit. New telemetry events should extend the typed model allowlist, add tests that prove no content or identifiers leak, and stay behind `TelemetryService` rather than adding sender calls from command, workflow, or service code.
