# Agent Instructions Guide Plan

## Goal

Teach ordinary Codex and Claude coding agents how to read a repository's
CodeAlmanac without duplicating the lifecycle agents' maintenance manuals, and
make the first setup step say exactly which global instruction files it updates.

## Scope

- Replace the short installed guide with a consumer guide focused on search,
  show, read-only navigation, evidence authority, and the maintenance boundary.
- Keep `src/codealmanac/services/setup/agent-guide.md` as the single canonical
  guide used by both Codex and Claude installers.
- Change the first setup step copy to:
  `Add CodeAlmanac instructions to your AGENTS.md / CLAUDE.md:`
- Add focused tests for the guide content and wizard copy.

## Out Of Scope

- Teaching ordinary coding agents to create, link, tag, or reorganize pages.
- Duplicating Init, Ingest, Garden, or Sync authoring instructions.
- Changing setup targets, filesystem destinations, or installer behavior.
- Reworking the setup renderer or the rest of the six-step wizard.

## Files

- Modify: `src/codealmanac/services/setup/agent-guide.md`
- Modify: `src/codealmanac/cli/dispatch/setup_tui.py`
- Modify: `tests/test_setup_service.py`
- Modify: `tests/test_cli.py`

## Verification

```bash
uv run pytest tests/test_setup_service.py tests/test_cli.py -k 'setup or instructions'
uv run ruff check src/codealmanac/cli/dispatch/setup_tui.py tests/test_setup_service.py tests/test_cli.py
```
