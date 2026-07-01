# Slice 131: Setup Service Boundaries

## Scope

Keep `codealmanac setup` and `codealmanac uninstall` behavior unchanged while
splitting setup service planning and automation-policy helpers out of the
service facade.

## Out of scope

- No interactive setup prompts.
- No setup terminal redesign.
- No automation scheduler behavior changes.
- No instruction install behavior changes.

## Design

Cosmic Python chapter 4 says the service layer defines use cases and separates
workflow orchestration from interfacing code. After slice 130, setup's
filesystem adapter is split; the remaining pressure is
`services/setup/service.py`, which still owns use-case orchestration, setup
plan assembly, automation recommendation commands, and automation request
conversion.

The split is:

```python
services.setup.service       # SetupService facade: call ports and return results
  -> planning.py             # SetupPlan, recommendations, next commands
  -> automation.py           # setup automation selection and request conversion
```

`SetupService` should read like the product transaction: build the plan,
install instructions if requested, install or remove automation through the
port, and return Pydantic results.

## Verification

- Existing setup service and CLI tests.
- Architecture guard that keeps `service.py` small and prevents plan/automation
  helpers from regrowing there.
- Isolated CLI dogfood for setup JSON plus uninstall.
- Full pytest, Ruff, and diff checks.
