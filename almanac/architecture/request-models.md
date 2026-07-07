---
title: Request Models
topics: [architecture]
sources:
  - id: ingest-requests
    type: file
    path: src/codealmanac/workflows/ingest/requests.py
    note: Ingest workflow request models and validators.
  - id: search-requests
    type: file
    path: src/codealmanac/services/search/requests.py
    note: Search service request model.
  - id: run-models
    type: file
    path: src/codealmanac/services/runs/models.py
    note: Run identifiers, run records, run specs, statuses, and queue models.
  - id: run-requests
    type: file
    path: src/codealmanac/services/runs/requests.py
    note: Runs service request models and validators.
  - id: core-model
    type: file
    path: src/codealmanac/core/models.py
    note: Shared frozen Pydantic base model.
---

# Request Models

Request models are the typed command boundary between adapters, workflows, and services. They turn loose input from the CLI, workers, or tests into frozen Pydantic objects before product behavior runs [@core-model]. This keeps CodeAlmanac from passing raw `argparse.Namespace` objects or ad hoc dictionaries into the application core.

The pattern is small but central. A request names the product action, carries only the fields that action needs, and validates local invariants near the owner of the action. Search, ingest, and runs show the shape clearly: search accepts repository selection and filters, ingest accepts source inputs and harness choices, and runs accept IDs, statuses, worker details, and queued specs [@search-requests] [@ingest-requests] [@run-requests].

## Frozen Shaped Input

All of these models inherit from `CodeAlmanacModel`, which is a frozen Pydantic `BaseModel` with `extra="forbid"` [@core-model]. That makes request objects immutable after creation and rejects unknown fields. For a CLI-driven product, this matters because parsing and validation happen at the edge, while service code receives a stable shape.

`SearchPagesRequest` shows the simplest form. It includes `cwd`, optional `repository_name`, optional full-text `query`, topic filters, a file mention filter, and an optional limit. Its validator rejects negative limits [@search-requests]. The search service can therefore focus on selecting the repository and calling the index, not reinterpreting command-line flags.

## Workflow Requests

`IngestRequest` is a workflow request because ingest spans sources, runs, prompts, manuals, and harness execution. It carries the current working directory, bounded input strings, harness kind, model name, optional repository name, title, guidance, and auto-commit policy [@ingest-requests]. Validators require at least one input and reject empty text for the model, title, and guidance fields [@ingest-requests].

`StartedIngestRequest` extends `IngestRequest` with `run_id` [@ingest-requests]. That split lets the workflow represent two phases: starting or queueing an ingest, and continuing an ingest that already has a run record. It is the same data shape plus the durable run identity.

## Run Models And Request Contracts

The run layer uses both request models and domain models. `RunKind`, `RunStatus`, and `RunEventKind` are string enums. `RunId` is constrained to non-empty alphanumeric, underscore, or dash characters. `RunRecord`, `RunLogEvent`, `RunSpec`, and worker models all inherit the same frozen base model [@run-models].

`RunSpec` is the queued-run payload. It carries a version, run kind, harness, model, inputs, title, guidance, and auto-commit flag [@run-models]. Its model validator enforces that ingest specs have inputs and garden specs do not, and it rejects unsupported queued run kinds [@run-models]. That keeps queue persistence from becoming a loose JSON envelope.

The request objects in `services/runs/requests.py` protect service verbs. `FinishRunRequest` accepts only terminal statuses, `AcquireRunWorkerLockRequest` requires a positive stale interval and owner text, and `StreamRunAttachRequest` requires a positive poll interval [@run-requests]. These checks belong at the service boundary because callers may be the CLI, the hidden worker, tests, or future wrappers.

## Relationship To The CLI

The [CLI Adapter Boundary](cli/adapter-boundary) builds request models from parsed arguments and then calls the app. For example, wiki search dispatch creates `SearchPagesRequest` from `args.query`, `args.topic`, `args.mentions`, and `args.limit` before calling `app.search.search(...)`. Ingest dispatch builds `IngestRequest` before queueing or running lifecycle work. The important rule is that the CLI adapter translates, while services and workflows own product meaning.

When adding a command or workflow, create the request near the service or workflow that owns the verb. The request model should express the product contract directly: stable field names, explicit optionality, enums for finite choices, and validators for invariants that should hold for every caller.
