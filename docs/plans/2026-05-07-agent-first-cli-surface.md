# Agent Provider Settings and Onboarding

> **For Claude:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Make provider setup and provider/model selection obvious, scriptable,
and diagnosable without undoing the new provider-adapter architecture. This
slice keeps `agents` as the human-friendly provider surface, adds a low-level
`config` surface for scripts, and improves setup/doctor around provider
readiness.

**Non-goals for this slice:** This slice intentionally stops at provider
settings and onboarding. The rest of the design is still required work, but it
must land as named follow-up slices so implementation and review stay coherent:

- **Slice: structured output protocol** — `CommandOutcome`, the four shapes
  (`success`, `noop`, `needs-action`, `error`), JSON/human rendering, and
  `bootstrap` / `capture` fixable-error migration.
- **Slice: command removals and deprecations** — `set`, `ps`, `show --raw`,
  `update --enable-notifier`, and `update --disable-notifier`, including a
  compatibility/deprecation policy.
- **Slice: setup wizard model picker** — provider-specific model selection,
  provider login retry UX, richer account display, and TTY-only interactions.
- **Slice: TOML migration and project-tier config** — `~/.almanac/config.toml`,
  `.almanac/config.toml`, config precedence, migration from JSON, and
  `--show-origin` across tiers.

## Read Before Coding

1. `docs/research/2026-05-07-agent-provider-cli-implementation.md`
2. `docs/research/2026-05-07-agent-provider-structure-writeup.md`
3. `docs/research/2026-05-07-cli-config-best-practices.md` sections 1, 5, 6, 9
4. `docs/research/2026-05-07-cli-surface-design.md` sections 1, 3, 6, 10, 13
5. Current provider code:
   - `src/agent/types.ts`
   - `src/agent/providers/index.ts`
   - `src/agent/providers/claude/index.ts`
   - `src/agent/providers/codex-cli.ts`
   - `src/agent/providers/cursor-cli.ts`
   - `src/agent/providers/status.ts`
6. Current command surfaces:
   - `src/commands/agents.ts`
   - `src/commands/setup.ts`
   - `src/commands/doctor.ts`
   - `src/update/config.ts`

## Design Decisions

### Keep `agents` as the provider UX

Provider management is a real noun group, like `topics`. `doctor` should report
provider health, but it should not be the only way to discover or change
provider settings.

Canonical friendly commands after this slice:

```bash
almanac agents list
almanac agents doctor
almanac agents use claude
almanac agents model claude claude-opus-4-6
almanac agents model claude --default
```

Keep existing compatibility commands:

```bash
almanac set default-agent claude
almanac set model claude claude-opus-4-6
```

Do not remove aliases in this slice. This repo has shipped releases, and
removing commands should happen only after a compatibility/deprecation plan.

### Add `config` as the low-level settings surface

Generic config commands are still useful and standard. They are the scriptable,
config-shaped interface, not the friendly provider UX.

Canonical low-level commands:

```bash
almanac config get agent.default
almanac config set agent.default claude
almanac config set agent.models.claude claude-opus-4-6
almanac config unset agent.models.claude
almanac config list --show-origin
```

`agents use claude` and `config set agent.default claude` write the same setting.
The former is what humans should discover first; the latter is what scripts and
agents can use when they already know the key.

### Provider first, model second

The user-facing model is hierarchical:

1. choose provider
2. choose or inherit model for that provider

Keep the primary flag shape:

```bash
almanac capture --agent claude --model claude-opus-4-6
almanac bootstrap --agent codex
```

Do not make `--model claude/opus` the main path. A model belongs to the
resolved provider; mixing the provider into `--model` makes combinations like
`--agent codex --model claude/opus` confusing.

Optional shorthand can come later:

```bash
almanac capture --agent claude/opus
almanac agents use claude/sonnet
```

If implemented, shorthand must parse into the same structured config:

```json
{
  "agent": {
    "default": "claude",
    "models": {
      "claude": "claude-sonnet-4-6",
      "codex": null,
      "cursor": null
    }
  }
}
```

This slice implements shorthand only where it cannot confuse precedence:
`--agent claude/opus`, `ALMANAC_AGENT=claude/opus`, `almanac setup --agent
claude/opus`, and `almanac agents use claude/opus`. The primary documented path
remains provider first, model second.

### Readiness is delegated to providers

Do not read provider home directories for auth. They are implementation details
owned by each provider CLI or SDK.

Provider readiness uses official/provider-owned surfaces:

| Provider | Installed | Auth | Runtime |
|---|---|---|---|
| Claude | `command -v claude` | `claude auth status --json` or `ANTHROPIC_API_KEY` | Anthropic Agent SDK |
| Codex | `command -v codex` | `codex login status` | `codex exec --json` |
| Cursor | `command -v cursor-agent` | `cursor-agent status` or `whoami` with timeout | `cursor-agent --print --output-format stream-json` |

If a provider is not ready, output must include the provider-owned fix command.
Do not add `almanac auth`.

### Setup should help, but not become a survey

Interactive `setup` should show all providers with readiness and recommend the
best default:

```text
Choose default agent

1. Claude   recommended   ready       rohan@example.com
2. Codex                  ready       ChatGPT
3. Cursor                 not ready   run: cursor-agent login

Choose agent [1]:
```

If the user chooses a not-ready provider in a TTY, setup can offer to run the
provider login command and then re-check:

```text
Cursor is not ready.

Run cursor-agent login now? [Y/n]
```

Non-interactive setup must never run login flows. It should print the fix
command and continue with explicit flags or defaults.

This slice improves the provider picker and readiness reporting. A full model
picker is deferred; setup should write each provider's recommended model policy
for now.

### Defaults vs provider inheritance

There are two different defaults:

- **bootstrap recommendation:** what setup writes for a new user, e.g. Claude
  Sonnet.
- **semantic default:** no model preference, let the provider choose.

In config, `null` means provider default/inherit. Setup may write an explicit
recommended model for Claude, while Codex/Cursor can stay `null` unless the user
sets a model.

`config unset agent.models.<id>` should restore `null`.

## Final Command Surface For This Slice

New or improved:

```bash
almanac agents list
almanac agents doctor
almanac agents use <provider>
almanac agents model <provider> <model>
almanac agents model <provider> --default

almanac config get <key>
almanac config set <key> <value>
almanac config unset <key>
almanac config list [--show-origin]

almanac doctor
almanac doctor --json
almanac setup
```

Compatibility retained:

```bash
almanac set default-agent <provider>
almanac set model <provider> <model>
almanac agents list
```

No command removals in this slice.

## Task 1 - Provider setup view model

**Files:**

- Create: `src/agent/provider-view.ts`
- Test: `test/provider-view.test.ts`

Create one helper that combines provider metadata, config, and readiness into a
stable view model used by `setup`, `agents list`, `agents doctor`, and `doctor`.

Shape:

```ts
export interface ProviderSetupChoice {
  id: AgentProviderId;
  label: string;
  recommended: boolean;
  selected: boolean;
  installed: boolean;
  authenticated: boolean;
  readiness: "ready" | "missing" | "not-authenticated";
  detail: string;
  account: string | null;
  configuredModel: string | null;
  effectiveModel: string | null;
  recommendedModel: string | null;
  fixCommand: string | null;
}
```

Rules:

- Recommended provider defaults to Claude when Claude is ready.
- If Claude is not ready, recommend the first ready provider in provider order.
- If no provider is ready, recommend Claude but mark it not ready.
- `effectiveModel` is the configured model, or the recommended model when setup
  will write one, or `null` for provider default.
- Fix commands:
  - Claude: `claude auth login --claudeai`
  - Codex: `codex login`
  - Cursor: `cursor-agent login`

Tests:

- all providers ready
- Claude missing but Codex ready
- no providers ready
- selected provider differs from recommended provider
- configured model vs provider default

## Task 2 - Improve `agents` commands

**Files:**

- Modify: `src/commands/agents.ts`
- Modify: `src/cli/register-setup-commands.ts`
- Tests: `test/agents.test.ts` or existing setup/cli tests

Add:

```bash
almanac agents doctor
almanac agents use <provider>
almanac agents model <provider> <model>
almanac agents model <provider> --default
```

`agents list` should become a concise settings view:

```text
codealmanac agents

Default: Claude
Config: ~/.almanac/config.json

* Claude   ready       model: claude-sonnet-4-6   rohan@example.com
  Codex    ready       model: provider default    ChatGPT
  Cursor   not ready   model: provider default    run: cursor-agent login

Override per run:
  almanac capture --agent codex
  almanac bootstrap --agent claude --model claude-opus-4-6
```

`agents doctor` should be provider-focused:

```text
Claude
  ✓ installed: /opt/homebrew/bin/claude
  ✓ auth: rohan@example.com
  ✓ model: claude-sonnet-4-6

Cursor
  ✓ installed: /usr/local/bin/cursor-agent
  ✗ auth: not signed in
    fix: cursor-agent login
```

`agents use <provider>` writes `agent.default`.

`agents model <provider> <model>` writes `agent.models.<provider>`.

`agents model <provider> --default` writes `null`.

Keep `set default-agent` and `set model` as aliases around the same helpers.

## Task 3 - Add low-level `config` commands

**Files:**

- Create: `src/commands/config.ts`
- Create: `src/commands/config-keys.ts`
- Modify: `src/cli/register-setup-commands.ts`
- Tests: `test/config-command.test.ts`

Supported keys in this slice:

```ts
agent.default
agent.models.<provider>
update_notifier
```

Commands:

```bash
almanac config get <key>
almanac config set <key> <value>
almanac config unset <key>
almanac config list [--show-origin] [--json]
```

Validation:

- Unknown key exits non-zero with a useful message listing known keys.
- Invalid provider id exits non-zero.
- `update_notifier` accepts only `true` or `false`.
- `agent.models.<provider>` accepts a non-empty string or `null`/`default` to
  clear to provider default.

Origin:

- `--show-origin` prints `(default)` or `(~/.almanac/config.json)`.
- JSON output always includes origin.

Do not add project-tier config in this slice.

## Task 4 - Improve setup provider choice

**Files:**

- Modify: `src/commands/setup.ts`
- Tests: `test/setup.test.ts`

Replace the free-text provider prompt with a numbered provider picker backed by
the provider setup view model.

Interactive shape:

```text
Choose default agent

1. Claude   recommended   ready       rohan@example.com
2. Codex                  ready       ChatGPT
3. Cursor                 not ready   run: cursor-agent login

Choose agent [1]:
```

If the selected provider is not ready and setup is interactive, offer to run the
provider login command, wait for it to exit, and re-check readiness. If the
login command fails, keep setup non-fatal and print the fix command.

If setup is non-interactive:

- Respect `--agent <provider>` when valid.
- Do not launch login flows.
- Print readiness/fix lines.
- Write config deterministically.

When setup writes the default provider, it also writes the recommended model for
that provider:

- Claude: `claude-sonnet-4-6`
- Codex: `null`
- Cursor: `null`

Do not add a model picker yet. That belongs in a setup polish follow-up.

## Task 5 - Fold provider readiness into `doctor`

**Files:**

- Modify: `src/commands/doctor.ts`
- Modify/add under: `src/commands/doctor-checks/`
- Tests: `test/doctor.test.ts`

`almanac doctor` should include provider state without replacing `agents`.

Human output:

```text
Providers
  ✓ claude   ready       claude-sonnet-4-6   rohan@example.com
  ✓ codex    ready       provider default
  ✗ cursor   not signed in
    fix: cursor-agent login
```

JSON excerpt:

```json
{
  "providers": [
    {
      "id": "claude",
      "installed": true,
      "authenticated": true,
      "account": "rohan@example.com",
      "model": "claude-sonnet-4-6",
      "recommended": true,
      "selected": true,
      "actions": []
    }
  ]
}
```

`doctor` remains a broad health report. `agents doctor` is the focused provider
view.

## Task 6 - Add env override support

**Files:**

- Add resolver near agent/config code, likely `src/agent/resolve.ts` or
  `src/commands/agent-selection.ts`
- Modify: `src/commands/bootstrap.ts`
- Modify: `src/commands/capture.ts`
- Tests: bootstrap/capture env precedence

Precedence:

```text
--agent flag > ALMANAC_AGENT env > config.agent.default > built-in default
--model flag > ALMANAC_MODEL env > config.agent.models[provider] > provider default
```

Formats:

- `ALMANAC_AGENT=claude`
- `ALMANAC_MODEL=claude-opus-4-6`

Env model is provider-local and scoped to the resolved provider. Do not support
provider/model syntax in env vars in this slice.

Invalid `ALMANAC_AGENT` should fail before the agent runs.

Do not cross-validate model strings against providers unless a provider exposes
reliable model metadata. The provider run should surface model errors.

## Task 7 - Guides and help

**Files:**

- Modify: `guides/mini.md`
- Modify: `guides/reference.md`
- Modify README command examples if needed

Update examples to show:

```bash
almanac agents list
almanac agents use claude
almanac agents model claude claude-opus-4-6
almanac config list --show-origin
ALMANAC_AGENT=codex almanac capture
```

Document command override precedence:

```text
flag > environment > config > provider default
```

Do not remove old command examples unless the replacement is already shipped.

## Task 8 - Verify

Run:

```bash
npm run lint
npm test
```

Manual smoke checks:

```bash
almanac agents list
almanac agents doctor
almanac config list --show-origin
almanac config set agent.default codex
almanac config unset agent.models.codex
ALMANAC_AGENT=cursor almanac capture --help
```

Expected:

- provider view is consistent across setup, agents, and doctor
- config commands show origins
- old `set` commands still work
- no command removals happened

## Required Follow-up Slices

These are not optional ideas. They are named follow-up slices required to
complete the CLI redesign. They stay out of this slice only because each changes
a different contract and deserves its own plan, implementation, and review.

### Slice: Structured output protocol

The four-shape `success` / `noop` / `needs-action` / `error` protocol is useful,
but it touches command return contracts broadly and should not be mixed with
provider onboarding.

Scope:

- create `CommandOutcome`
- render human and JSON output consistently
- migrate `bootstrap` and `capture` fixable auth/readiness failures to
  `needs-action`
- keep query/read commands stable unless their current shape is ambiguous

### Slice: Command removals and deprecations

Scope:

- decide deprecation windows for `set`, `ps`, `show --raw`, and update notifier
  flags
- add warnings or compatibility aliases as needed
- remove only after guides and help prefer the replacement commands
- update README/guides with migration mapping

### Slice: Setup wizard model picker

Scope:

- add provider-specific model selection after provider choice
- expose recommended models and provider defaults in the picker
- offer provider login retry UX in TTY mode
- keep non-interactive setup scriptable and non-blocking

### Slice: TOML migration and project-tier config

Scope:

- migrate from `~/.almanac/config.json` to `~/.almanac/config.toml`
- add `.almanac/config.toml` as a project-tier peer of `topics.yaml`
- implement precedence: flag > environment > project config > user config >
  provider default
- implement origin reporting across tiers
- provide an idempotent migration path for existing JSON users

## Review Focus

The reviewer should check:

1. Is provider management discoverable from `almanac --help`?
2. Are `agents`, `config`, `setup`, and `doctor` using the same provider view
   model?
3. Are config writes dumb and predictable?
4. Are readiness checks delegated to provider-owned status surfaces?
5. Are compatibility commands retained?
6. Is the slice still narrow enough to implement and review safely?
