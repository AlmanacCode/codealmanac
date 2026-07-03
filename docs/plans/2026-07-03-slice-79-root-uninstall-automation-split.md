# Slice 79: Split Root Uninstall From Local Automation

Status: planned.

## Why This Slice

`codealmanac setup` is now the cloud-first setup command. It signs in and
installs Codex/Claude instruction files. It no longer installs scheduled local
automation.

`codealmanac uninstall` still exposes `--keep-automation` and `SetupService`
still depends on the automation service so root uninstall can remove scheduled
automation. That preserves the old local setup model inside the cloud setup
domain. It is split-brain: the top-level setup/uninstall noun looks cloud-owned,
but one branch of it still reaches into local scheduling.

The public product model should be crisp:

```text
codealmanac setup       -> cloud login + global agent instructions
codealmanac uninstall   -> remove setup-owned global agent/auth artifacts
codealmanac automation  -> manage local scheduled automation
codealmanac local ...   -> configure and run local repo maintenance
```

## Read Before Coding

- `MANUAL.md`: feature work should reshape the codebase so the feature fits.
- `docs/reference/cosmic-python/chapter_04_service_layer.md`: the service layer
  is the use-case entrypoint, not a place for unrelated cleanup.
- `docs/reference/cosmic-python/chapter_10_commands.md`: command/request objects
  capture intent; root uninstall intent should not include local scheduler
  cleanup.
- `docs/reference/cosmic-python/chapter_13_dependency_injection.md`: dependency
  injection should make real dependencies explicit; this slice removes a false
  dependency from setup wiring.
- `docs/codealmanac-launch/cli-contract.md`: root setup is cloud setup, local
  schedules stay behind explicit local/automation commands.

## Scope

Must:

- Remove `--keep-automation` from `codealmanac uninstall`.
- Remove automation cleanup from `SetupService.uninstall`.
- Remove `SetupAutomationCleaner` from setup service ports and app wiring.
- Remove `kept_automation` and `automation_uninstall` from setup uninstall
  result models.
- Update setup/uninstall rendering so it only talks about agent instructions.
- Update tests and architecture guardrails to enforce the split.
- Update README and launch docs so users are directed to explicit automation
  commands for scheduler cleanup.

Should:

- Keep `codealmanac automation uninstall` unchanged.
- Keep explicit `codealmanac local ...` surfaces unchanged.
- Keep JSON setup/uninstall output shaped, but drop stale automation fields.
- Make the public command table clearer about root uninstall vs automation.

Out of scope:

- Redesign the local automation service.
- Remove hidden compatibility commands such as root `jobs` or `sync`.
- Change cloud login, capture, repo, or runs behavior.
- Publish a package unless tests/build pass.

## Wireframe

Target shape:

```python
result = app.setup.uninstall(
    RunUninstallRequest(
        targets=(SetupTarget.CODEX, SetupTarget.CLAUDE),
        keep_instructions=args.keep_instructions,
    )
)

SetupService.uninstall(request):
    if request.keep_instructions:
        return UninstallResult(kept_instructions=True)
    return UninstallResult(changes=instructions.uninstall(request.targets))
```

Automation cleanup stays explicit:

```bash
codealmanac automation uninstall
```

## Verification

Run focused tests first:

```bash
uv run pytest tests/test_setup_service.py tests/test_cli.py::test_cli_setup_rejects_root_automation_flags tests/test_public_contract.py -q
```

Then run architecture checks touched by parser/dispatch/setup ownership:

```bash
uv run pytest tests/test_architecture.py -q
```

Before commit:

```bash
uv run pytest
uv run ruff check .
git diff --check
uv build --out-dir dist
uvx twine check dist/*
```

If this changes published CLI behavior, publish the new PyPI version and smoke
test a fresh install.
