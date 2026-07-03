# Slice 72: Cloud setup UX cleanup

## Scope

Make root `codealmanac setup` feel like the launch product instead of a
leftover local scheduler installer.

The intended command contract is:

```text
codealmanac setup
  -> cloud login unless already signed in
  -> install/update Codex and Claude instruction files
  -> show clear next commands
  -> never install or recommend local scheduled automation
```

Local maintenance remains explicit:

```text
codealmanac local setup
codealmanac automation ...
```

## Design

The setup service owns the product use case. It should not carry root setup
automation fields that no public parser exposes. The CLI edge maps flags into
`RunSetupRequest`; the renderer only displays cloud login, instruction changes,
and next commands.

Wireframe:

```python
result = app.setup.run(RunSetupRequest(...))

render_setup_result(result):
    banner("CodeAlmanac")
    section("Cloud", result.cloud_login)
    section("Agent instructions", result.changes)
    section("Next", result.plan.next_commands)
```

This follows the service-layer rule from Cosmic Python: the CLI is an
entrypoint, while the service captures the use case. It also follows the
commands chapter: root setup is an imperative command with one expected outcome,
not a bag of optional local scheduler events.

## Files

- `src/codealmanac/services/setup/models.py`
- `src/codealmanac/services/setup/requests.py`
- `src/codealmanac/services/setup/planning.py`
- `src/codealmanac/services/setup/service.py`
- `src/codealmanac/cli/render/setup.py`
- setup-focused tests
- launch docs and progress notes

## Out Of Scope

- Do not change cloud login/AuthKit.
- Do not change capture credential semantics.
- Do not change local setup behavior.
- Do not remove `codealmanac automation`; only remove it from root setup.
- Do not publish PyPI unless source verification shows this slice changes the
  public package behavior enough to warrant release.

## Verification

- Setup service tests prove `RunSetupRequest` has no root scheduler fields.
- CLI tests prove root setup output has no scheduled automation section or
  automation next command.
- CLI tests prove the banner and next commands still render in text mode.
- Existing local setup/automation tests still pass.
- `uv run pytest tests/test_setup_service.py tests/test_cli.py -q`
- `uv run ruff check .`
- `git diff --check`
- Source smoke:
  `uv run codealmanac setup --yes --skip-login --target codex`

