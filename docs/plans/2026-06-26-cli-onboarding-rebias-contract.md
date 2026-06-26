# CodeAlmanac CLI Onboarding Rebias Contract

Date: 2026-06-26  
Scope: `../codealmanac` CLI setup/onboarding only

## New Bias

Hosted usealmanac creates and updates wikis. The local CodeAlmanac CLI gives coding agents fast local query access to the checked-in `.almanac/` wiki.

No new commands for this launch slice. Change onboarding defaults/copy and keep advanced commands available.

## Current Onboarding

Current opening:

```text
a living wiki for codebases, for your agent

Set up your automatic codebase wiki

Almanac
```

Current prompts:

```text
Choose your agent
Choose the AI agent Almanac should use.

Running from an ephemeral npx location. Install globally so 'almanac' stays on PATH? [Y/n]

Keep your codebase wiki synced automatically? [Y/n]

Keep Almanac automatically updated? [Y/n]

Add Almanac instructions for your AI agents? [Y/n]

Commit Almanac wiki updates automatically? [Y/n]
```

Current ending when the repo already has pages:

```text
Setup complete

Next steps

This repo already has a wiki (N pages)

1. Start querying your wiki:
   almanac search --mentions <file>
2. Work normally - scheduled sync absorbs new chats
```

Current ending when the repo has no wiki:

```text
Setup complete

Next steps

1. cd into a repo you want to document
2. almanac init  # build the wiki
3. Work normally - scheduled sync absorbs new chats
```

## Product Decisions

Remove these from first-run onboarding:

```text
Keep your codebase wiki synced automatically? [Y/n]
Commit Almanac wiki updates automatically? [Y/n]
```

Keep this, but rename it:

```text
Keep Almanac automatically updated? [Y/n]
```

New wording:

```text
Keep the Almanac CLI updated automatically? [Y/n]
```

Do not delete local automation. Users can still opt in manually:

```bash
almanac automation install
```

Do not delete auto-commit controls. Users can still opt in manually:

```bash
almanac setup --auto-commit
almanac config set auto_commit true
```

## Setup Gates

Every setup action has a default. The onboarding UI decides which gates to ask about.

```text
sync_automation:    default false, hidden in normal onboarding
cli_auto_update:    default true, ask in normal onboarding
agent_instructions: default true, ask in normal onboarding
auto_commit:        default false, hidden in normal onboarding
```

This is the architecture rule for implementation: defaults live in one place, prompts only override exposed gates, and setup steps only execute the final plan.

## New Onboarding

New opening:

```text
a living wiki for codebases, for your agent

Set up local Almanac access

Almanac
```

New prompts:

```text
Choose your agent
Choose the AI agent Almanac should guide.

Running from an ephemeral npx location. Install globally so 'almanac' stays on PATH? [Y/n]

Keep the Almanac CLI updated automatically? [Y/n]

Add Almanac instructions for your AI agents? [Y/n]
```

Default setup should not:

- install scheduled `almanac sync`
- install scheduled `almanac garden`
- ask about `auto_commit`
- enable `auto_commit`
- say scheduled sync is the normal way wiki content changes

## New Final Next Steps

When the current repo already has pages:

```text
Next steps

This repo already has a wiki (N pages)

1. Start querying it locally:
   almanac search --mentions <file>
   almanac search "auth"

2. Read one of the result pages:
   almanac show <result-slug>
```

When the current repo has no wiki:

```text
Next steps

1. Create this repo's wiki from the dashboard:
   https://codealmanac.com/dashboard

2. After the .almanac/ files land in the repo, query locally:
   almanac search "auth"
```

Existing detection already exists: `countExistingPages(process.cwd())` in `src/cli/commands/setup/next-steps.ts`. It walks up from the current directory, looks for `.almanac/pages/`, and counts `.md` files.

## Automation Contract

Automation remains advanced/local.

| Command | Behavior |
|---|---|
| `almanac automation install` | Installs scheduled `sync` every `5h` and scheduled `garden` every `4h`. |
| `almanac automation install sync` | Installs only scheduled `sync --quiet 45m`. |
| `almanac automation install garden` | Installs only scheduled `garden`. |
| `almanac automation install --garden-off` | Installs default sync automation and disables scheduled Garden. |
| `almanac automation status` | Shows installed automation state. |
| `almanac automation install update --every 1d` | Installs scheduled CLI self-update only. |

## Exact Code Changes

### `src/config/schema.ts`

Change the default:

```ts
auto_commit: true,
```

to:

```ts
auto_commit: false,
```

Update the comment from:

```ts
/** Whether AI lifecycle runs may create git commits for wiki source files. Default: true. */
```

to:

```ts
/** Whether AI lifecycle runs may create git commits for wiki source files. Default: false. */
```

Effect: users without explicit config get safer default `false`. Users with `auto_commit = true` in config keep it.

### `src/cli/commands/setup/output.ts`

Change the headline:

```text
Set up your automatic codebase wiki
```

to:

```text
Set up local Almanac access
```

Keep the existing logo subline:

```text
a living wiki for codebases, for your agent
```

### `src/cli/commands/setup/setup-plan.ts`

Add a small plan/defaults file. This is the clean architecture change.

It makes setup behave like gates:

```ts
export const SETUP_DEFAULTS = {
  syncAutomation: false,
  cliAutoUpdate: true,
  agentInstructions: true,
  autoCommit: false,
} as const;
```

Add a plan type:

```ts
export interface SetupPlan {
  syncAutomation: boolean;
  cliAutoUpdate: boolean;
  agentInstructions: boolean;
  autoCommit: boolean;
}
```

Add a plan builder:

```ts
export async function buildSetupPlan(args: {
  out: NodeJS.WritableStream;
  interactive: boolean;
  options: SetupOptions;
}): Promise<SetupPlan> {
  return {
    syncAutomation: resolveSyncAutomation(args.options),
    cliAutoUpdate: await resolveCliAutoUpdate(args),
    agentInstructions: await resolveAgentInstructions(args),
    autoCommit: resolveAutoCommit(args.options),
  };
}
```

Gate rules:

```ts
function resolveSyncAutomation(options: SetupOptions): boolean {
  if (options.skipAutomation === true) return false;
  return options.automationEvery !== undefined ||
    options.automationQuiet !== undefined ||
    options.gardenEvery !== undefined ||
    options.gardenOff === true;
}
```

```ts
function resolveAutoCommit(options: SetupOptions): boolean {
  if (options.autoCommit === true) return true;
  if (options.autoCommit === false) return false;
  return SETUP_DEFAULTS.autoCommit;
}
```

```ts
async function resolveCliAutoUpdate(args): Promise<boolean> {
  if (args.options.skipAutomation === true) return false;
  if (args.options.autoUpdate === true) return true;
  if (!args.interactive) return SETUP_DEFAULTS.cliAutoUpdate;
  return await confirmBoolean(
    args.out,
    "Keep the Almanac CLI updated automatically?",
    SETUP_DEFAULTS.cliAutoUpdate,
  );
}
```

```ts
async function resolveAgentInstructions(args): Promise<boolean> {
  if (args.options.skipGuides === true) return false;
  if (!args.interactive) return SETUP_DEFAULTS.agentInstructions;
  return await confirmBoolean(
    args.out,
    "Add Almanac instructions for your AI agents?",
    SETUP_DEFAULTS.agentInstructions,
  );
}
```

The exact function names can change, but the product contract is: every setup action has a default, and prompts only override exposed gates.

### `src/cli/commands/setup/auto-update-step.ts`

Add a new setup step file.

Purpose: execute the `cliAutoUpdate` gate from the setup plan.

Behavior:

- if `plan.cliAutoUpdate` is true, call `runAutomationInstall({ tasks: ["update"] })`
- if `plan.cliAutoUpdate` is false, do not write an update plist
- no prompts live here; prompts/defaults live in `setup-plan.ts`

This new file should reuse:

```ts
runAutomationInstall
BAR
DIM
stepDone
stepSkipped
stepActive
```

It should not install `sync` or `garden`.

### `src/cli/commands/setup/automation-step.ts`

Leave the existing sync/garden implementation available.

But change its role:

- no longer called during default setup
- only executes when `plan.syncAutomation` is true
- still used as compatibility path for `--sync-every`, `--sync-quiet`, `--garden-every`, `--garden-off`

Optional cleanup after splitting auto-update:

- remove the auto-update code from this file
- keep only sync/garden responsibilities here

### `src/cli/commands/setup/auto-commit-step.ts`

Remove the interactive prompt path.

Current behavior:

```ts
else if (args.interactive) {
  autoCommitAction = await confirm(
    args.out,
    "Commit Almanac wiki updates automatically?",
    true,
  );
}
```

New behavior:

- if `plan.autoCommit` is true, write `auto_commit: true`
- if `plan.autoCommit` is false, do not enable automatic commits
- `--no-auto-commit` may still write `auto_commit: false` explicitly for compatibility
- no prompts live here; prompts/defaults live in `setup-plan.ts`

Do not ask:

```text
Commit Almanac wiki updates automatically? [Y/n]
```

### `src/cli/commands/setup/index.ts`

Change the orchestration from "call each old setup step and let it ask questions" to "build a plan, then execute gates."

Imports:

- add `buildSetupPlan`
- add `runAutoUpdateSetupStep`
- keep `runAutomationSetupStep`, but execute it only when `plan.syncAutomation` is true
- keep `runAutoCommitSetupStep`, but execute it only when `plan.autoCommit` is true or `options.autoCommit === false`

Change current execution from:

```ts
const automation = await runAutomationSetupStep(...)
...
await runAutoCommitSetupStep(...)
```

to:

```ts
const plan = await buildSetupPlan({ out, interactive, options });

if (plan.syncAutomation) {
  const automation = await runAutomationSetupStep(...)
  if (!automation.ok) return ...
}

if (plan.cliAutoUpdate) {
  const update = await runAutoUpdateSetupStep(...)
  if (!update.ok) return ...
}

if (plan.agentInstructions) {
  const guides = await runGuidesSetupStep(...)
  if (!guides.ok) return ...
}

if (plan.autoCommit || options.autoCommit === false) {
  await runAutoCommitSetupStep(...)
}
```

Also update comments/docs in this file. The setup docstring currently says setup installs launchd `sync` and `garden`; that must change.

### `src/cli/commands/setup/guides-step.ts`

Remove prompt ownership from this step if the plan builder owns prompts.

New behavior:

- if called, install agent instructions
- if not called, do nothing
- keep `skipGuides` as a compatibility input to `buildSetupPlan`

This keeps the rule consistent: `setup-plan.ts` decides gates; step files perform actions.

### `src/cli/commands/setup/next-steps.ts`

Keep `countExistingPages`. It already does the needed detection.

Change existing-wiki output from:

```text
1. Start querying your wiki:
     almanac search --mentions <file>
2. Work normally - scheduled sync absorbs new chats
```

to:

```text
1. Start querying it locally:
     almanac search --mentions <file>
     almanac search "auth"
2. Read one of the result pages:
     almanac show <result-slug>
```

Change no-wiki output from:

```text
1. cd into a repo you want to document
2. almanac init  # build the wiki
3. Work normally - scheduled sync absorbs new chats
```

to:

```text
1. Create this repo's wiki from the dashboard:
     https://codealmanac.com/dashboard
2. After the .almanac/ files land in the repo, query locally:
     almanac search "auth"
```

### `src/cli/register-setup-commands.ts`

Keep the old flags working:

```text
--sync-every
--sync-quiet
--garden-every
--garden-off
--auto-commit
--no-auto-commit
```

But update descriptions if needed so they read like explicit advanced controls, not default onboarding.

Do not add commands.

### `src/cli/sqlite-free.ts`

Keep parsing old setup shortcut flags.

Reason: `npx codealmanac --sync-every 2h` should remain a compatibility path for contrarian/advanced users.

No new behavior is needed unless the setup options shape changes.

### `README.md`

Change quickstart from local creation:

```bash
npx codealmanac

cd your-repo
almanac init

almanac search "auth"
almanac show checkout-flow
```

to local access/query:

```bash
npx codealmanac

cd your-repo
almanac search "auth"
almanac search --mentions src/auth/
almanac show <result-slug>
```

Move these to advanced/local automation docs:

```bash
almanac init
almanac automation install
almanac setup --auto-commit
almanac config set auto_commit true
```

Keep `almanac init` documented, but not as the happy path.

## Exact Test Changes

### `test/setup.test.ts`

Change the test named:

```text
installs automation + guides + CLAUDE.md import when --yes
```

to assert:

- setup exits 0
- sync plist is not written
- garden plist is not written
- guide files are still written
- legacy Codex hooks are still cleaned up if that remains part of guide setup
- config does not get `automation.sync_since`
- `auto_commit` remains false by default

Change:

```text
enables auto-commit by default in unattended setup
```

to:

```text
leaves auto-commit disabled by default in unattended setup
```

Add explicit flag coverage:

```text
--auto-commit enables auto_commit
--no-auto-commit disables auto_commit
```

Add setup compatibility coverage:

```text
explicit sync setup flags still install sync/garden automation
```

Add auto-update coverage:

```text
setup installs update automation only when user/flag opts in
```

### `test/setup-plan.test.ts`

Add focused tests for the new gate builder:

```text
defaults are syncAutomation=false, cliAutoUpdate=true, agentInstructions=true, autoCommit=false
skipAutomation disables syncAutomation and cliAutoUpdate
skipGuides disables agentInstructions
autoUpdate=true enables cliAutoUpdate without a prompt
autoCommit=true enables autoCommit
autoCommit=false keeps autoCommit false
sync/garden flags enable syncAutomation
```

This keeps the product defaults tested separately from launchd file-writing.

### `test/automation.test.ts`

Keep existing tests proving:

```text
runAutomationInstall() installs sync + garden by default
```

This feature is not deleted.

### `test/config-command.test.ts`

Change default expectations:

```ts
expect(listed.stdout).toContain("true")
```

to expect false for `auto_commit`.

Change unset expectation:

```ts
auto_commit: true
```

to:

```ts
auto_commit: false
```

### `test/cli.test.ts`

Keep parser compatibility tests for setup flags.

Do not remove:

```text
--sync-every
--sync-quiet
--garden-every
--garden-off
--auto-commit
--no-auto-commit
```

## Python Version Of The Plan

This is not implementation code. It is the same flow written in Python-shaped pseudocode for readability.

```python
SETUP_DEFAULTS = {
    "sync_automation": False,
    "cli_auto_update": True,
    "agent_instructions": True,
    "auto_commit": False,
}


def build_setup_plan(options, interactive):
    return {
        "sync_automation": answer_or_default(
            gate="sync_automation",
            default=SETUP_DEFAULTS["sync_automation"],
            answer=sync_automation_answer(options, interactive),
        ),
        "cli_auto_update": answer_or_default(
            gate="cli_auto_update",
            default=SETUP_DEFAULTS["cli_auto_update"],
            answer=cli_auto_update_answer(options, interactive),
        ),
        "agent_instructions": answer_or_default(
            gate="agent_instructions",
            default=SETUP_DEFAULTS["agent_instructions"],
            answer=agent_instructions_answer(options, interactive),
        ),
        "auto_commit": answer_or_default(
            gate="auto_commit",
            default=SETUP_DEFAULTS["auto_commit"],
            answer=auto_commit_answer(options, interactive),
        ),
    }


def answer_or_default(gate, default, answer):
    if answer is None:
        return default
    return answer
```

Gate answers:

```python
def sync_automation_answer(options, interactive):
    # Hidden in normal onboarding. Only explicit advanced setup flags turn it on.
    if options.skip_automation:
        return False

    if (
        options.sync_every is not None
        or options.sync_quiet is not None
        or options.garden_every is not None
        or options.garden_off is True
    ):
        return True

    return None


def cli_auto_update_answer(options, interactive):
    if options.skip_automation:
        return False

    if options.auto_update is True:
        return True

    if interactive:
        return ask_yes_no(
            "Keep the Almanac CLI updated automatically?",
            default=SETUP_DEFAULTS["cli_auto_update"],
        )

    return None


def agent_instructions_answer(options, interactive):
    if options.skip_guides:
        return False

    if interactive:
        return ask_yes_no(
            "Add Almanac instructions for your AI agents?",
            default=SETUP_DEFAULTS["agent_instructions"],
        )

    return None


def auto_commit_answer(options, interactive):
    # Hidden in normal onboarding. Only explicit flags affect it.
    if options.auto_commit is True:
        return True

    if options.auto_commit is False:
        return False

    return None
```

Setup execution:

```python
def run_setup(options):
    if nothing_to_install(options):
        print("almanac: nothing to install - use --help to see what setup does")
        return ok()

    print_banner("Set up local Almanac access")
    print_badge("Almanac")

    agent = choose_default_agent(
        requested=options.agent,
        requested_model=options.model,
    )
    if not agent.ok:
        return error(agent.error)

    print_done(f"Agent: {agent.provider}")

    global_install = run_global_install_step(options)

    plan = build_setup_plan(options, interactive=is_terminal())

    if plan["sync_automation"]:
        result = install_sync_and_garden_automation(options)
        if not result.ok:
            return result

    if plan["cli_auto_update"]:
        result = install_cli_auto_update(options)
        if not result.ok:
            return result

    if plan["agent_instructions"]:
        result = install_agent_instructions(options)
        if not result.ok:
            return result

    if plan["auto_commit"]:
        set_config("auto_commit", True)
    elif options.auto_commit is False:
        set_config("auto_commit", False)

    print_done("Setup complete")

    page_count = count_existing_pages(cwd())
    print_next_steps(page_count)

    return ok()
```

Page detection:

```python
def count_existing_pages(cwd):
    directory = cwd

    for _ in range(10):
        pages_dir = directory / ".almanac" / "pages"

        if pages_dir.exists():
            return count_files_ending_with_md(pages_dir)

        parent = directory.parent
        if parent == directory:
            break
        directory = parent

    return 0
```

Next steps:

```python
def print_next_steps(page_count):
    if page_count > 0:
        print("This repo already has a wiki")
        print("almanac search --mentions <file>")
        print('almanac search "auth"')
        print("almanac show <result-slug>")
    else:
        print("Create this repo's wiki from the dashboard:")
        print("https://codealmanac.com/dashboard")
        print('Then run: almanac search "auth"')
```

Auto-commit:

```python
def default_config():
    return {
        "auto_commit": False,
        "update_notifier": True,
        "agent": {
            "default": "codex",
        },
        "automation": {
            "sync_since": None,
        },
    }
```

## Acceptance Criteria

- First-run setup no longer asks `Keep your codebase wiki synced automatically?`.
- First-run setup no longer asks `Commit Almanac wiki updates automatically?`.
- First-run setup no longer installs sync/garden launchd jobs by default.
- First-run setup no longer enables `auto_commit` by default.
- First-run setup can still install CLI auto-update.
- `almanac automation install` still installs sync/garden by default.
- Explicit sync/garden setup flags still work as a compatibility path.
- Explicit `--auto-commit` still works.
- README no longer frames `almanac init` plus scheduled sync as the default happy path.
