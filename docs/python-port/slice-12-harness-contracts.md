# Slice 12: Harness Contracts

## Scope

Add the service-owned contract future lifecycle workflows will use to run AI
agents:

```python
app.harnesses.run(
    RunHarnessRequest(
        kind=HarnessKind.CODEX,
        cwd=repo,
        prompt="Update the wiki from these source briefs.",
    )
)
```

This slice does not implement Codex or Claude adapters and does not expose a
public CLI command. It names the port that `workflows/ingest`, `workflows/sync`,
and `workflows/garden` will call later.

## Architecture

Cosmic Python chapter 4 puts use cases behind a service layer, and chapter 13
keeps dependency wiring in a composition root. For CodeAlmanac, the implication
is:

```text
cli/main.py
  -> app.py
    -> workflows/ingest
      -> services/harnesses
        -> services/harnesses/ports.py
          -> integrations/harnesses/codex
          -> integrations/harnesses/claude
```

`services/harnesses` owns the normalized task/result/readiness contract.
Concrete integrations will translate Codex or Claude runtime details into this
contract. CLI commands and workflows must not import concrete harness modules.

## Library Decision

The port uses Python's standard `typing.Protocol` so concrete adapters only
need to satisfy the structural contract. The shaped request/result data remains
Pydantic-backed, and `HarnessKind` / `HarnessRunStatus` are enums.

References:

- https://docs.python.org/3.12/library/typing.html#typing.Protocol
- https://docs.pydantic.dev/latest/api/standard_library_types/#enums

## Tests

- registered adapter run path
- adapter readiness reporting
- missing adapter error
- duplicate adapter rejection
- empty prompt validation

## Remaining Risk

The result contract is intentionally small: status, output text, summary, and
changed files. Concrete Codex and Claude adapters may reveal additional durable
fields, but those should be added when an adapter or workflow needs them.
