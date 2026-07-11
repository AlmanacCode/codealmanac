# User TOML automation review fixes

## Must-fix

- Remove the optional-config setup fallback. Setup now requires `ConfigService`,
  writes one complete user config, and reconciles automation through it.
- Make launchd uninstall boot out by service label even when its plist is
  missing, so disabled config cannot leave a loaded job running.

## Should-fix

- Rename setup's remaining scheduler dependency to `AutomationRemover`; setup
  uses it only for full uninstall, not installation.
- Require the already-loaded `UserConfig` in setup selection instead of silently
  constructing defaults inside the TUI adapter.
- Remove the duplicated top-level setup automation result; the reconciliation
  result belongs under `config_update`.
- Cover scheduler-failure, invalid-direct-TOML, and retry semantics.

## Polish

- Correct stale scheduler, config-topic, and read-only automation help wording.

## Verification

- Run setup/config tests, the full pytest suite, Ruff, `git diff --check`, and
  `codealmanac validate`.
