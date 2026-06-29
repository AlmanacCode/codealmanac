# Slice 8: Doctor Diagnostics

## Scope

Add the local diagnostic command:

```text
codealmanac doctor [--wiki <name>] [--json]
```

`doctor` answers whether the local Python install and the selected repo wiki are
usable. It is separate from `health`: doctor checks setup/readiness; health
checks graph integrity.

## Product Semantics

The Python v1 doctor is local-only. It does not check hosted login, provider
auth, scheduler automation, update notifications, npm installs, or Node native
bindings. Those checks existed in the archived TypeScript command, but their
services do not exist in this Python product yet.

The initial report has two sections:

- `install`: CodeAlmanac version, Python runtime, registry path
- `wiki`: selected repo, registry entry, index summary, health problem count

If no wiki is resolvable from the current directory, doctor returns an info check
with `run: codealmanac init` rather than failing the whole command.

## Architecture

Cosmic Python chapter 13's dependency-injection pressure applies here: keep
dependencies explicit and assembled in one composition root. `app.py` wires a
`DiagnosticsService`; CLI and future server edges call that service instead of
embedding probes in command code.

`diagnostics` depends on service-owned contracts:

- `workspaces` resolves the current or named local wiki.
- `index` owns index rebuild/count/health projections.

`diagnostics` must not open SQLite directly or call CLI commands.

## Out Of Scope

- `doctor --fix`
- provider readiness
- automation readiness
- hosted readiness
- self-update checks
- `install-only` / `wiki-only` flags

## Tests

- service test for no current wiki
- service test for selected wiki with index and health checks
- CLI text rendering test
- CLI JSON rendering test
- dogfood `codealmanac doctor --json` in this repo
