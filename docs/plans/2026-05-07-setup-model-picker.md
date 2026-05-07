# 2026-05-07 Setup Model Picker

## Scope

Make setup provider-first and model-second without blocking scripts.

- interactive setup shows provider-specific model choices after provider choice
- setup accepts `--model <model>` as the scriptable equivalent
- provider/model shorthand in `--agent claude/opus` remains supported
- Codex and Cursor default to provider inheritance unless the user chooses a
  model
- Claude exposes its recommended package default model
- non-TTY and `--yes` setup never prompt for login or model input

## Design

Provider readiness stays in `buildProviderSetupView`. The same view now includes
`modelChoices` so setup can render choices without hard-coding provider-specific
model behavior.

Model choice rules:

- explicit `--model` wins
- `--agent provider/model` is accepted as shorthand
- interactive setup prompts after provider selection when no model was supplied
- non-interactive setup writes the configured model, or the provider's package
  default, or `null` for provider inheritance

No provider validates model strings in setup. The selected provider owns model
validation when `bootstrap` or `capture` runs.

## Files

- `src/agent/provider-view.ts`
- `src/commands/setup.ts`
- `src/cli.ts`
- `src/cli/register-setup-commands.ts`
- `test/setup.test.ts`
- `test/provider-view.test.ts`
- `test/cli.test.ts`
- README/reference guide updates

## Verification

- provider view tests cover model choices
- setup tests cover `--model` and provider-default inheritance
- CLI tests cover setup shortcut parsing and Commander option wiring
- full lint, build, and test before commit
