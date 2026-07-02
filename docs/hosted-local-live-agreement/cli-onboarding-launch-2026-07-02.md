# CLI And Onboarding Launch Decisions

Date: 2026-07-02.
Status: active design note.

This note records launch decisions for the CodeAlmanac CLI, browser onboarding,
capture setup, branch trigger policy, and local/cloud coexistence.

## Browser Versus CLI Responsibility

`codealmanac setup` starts cloud onboarding. It opens a browser session and
waits for the browser to finish the product setup.

The browser owns:

- GitHub sign-in
- GitHub App installation
- account/org selection
- repository selection
- maintained branch selection
- per-branch delivery policy
- cloud capture consent
- billing/plan prompts when needed

The CLI owns:

- storing the local cloud auth token
- installing local CodeAlmanac instruction files
- probing installed local agent tools
- installing capture hooks only after cloud capture consent exists
- writing local machine status back to cloud
- opening the relevant cloud URL from the current checkout

The browser should not pretend it can inspect the local machine. The CLI should
not ask the user to make product policy decisions that belong in the dashboard.

## Capture Setup

Capture consent belongs in browser onboarding. Capture installation belongs in
the CLI.

Concrete flow:

```text
codealmanac setup
  -> opens codealmanac.com/setup?cli_session=...
  -> browser asks whether cloud capture should be enabled
  -> CLI receives consent result
  -> CLI probes Codex/Claude availability
  -> CLI installs capture for detected/eligible tools
  -> CLI reports provider status to cloud
```

Provider probing is useful. The CLI should check whether Codex and Claude are
installed/configurable, but this should be status detection, not a blocking
question.

Possible provider states:

```text
installed
not_found
found_but_not_authenticated
configured
needs_repair
unsupported_version
```

If the user installs Codex or Claude later, `codealmanac capture repair` should
pick it up.

## Branch Triggers And Delivery

Maintained branch and delivery policy are one row of configuration.

The dashboard should model this as:

```text
repo trigger policy
  branch: main
  enabled: true
  delivery_mode: pr | commit

repo trigger policy
  branch: dev
  enabled: true
  delivery_mode: pr | commit
```

The UI can offer account or repo defaults, but the durable setting is per
branch. This matches the product rule: the trigger fires because a maintained
branch changed, and delivery should be deterministic for that branch.

## Bare `codealmanac`

The bare command should open the cloud wiki for the current checkout:

```text
codealmanac
```

Resolution:

```text
current git remote + branch
  -> cloud API resolves repository
  -> open the cloud wiki URL
```

If the repo is not connected, open the setup URL for that repo. If the command
runs in non-interactive output mode, print the URL instead of opening a browser.

The CLI should use a stable resolver URL such as:

```text
https://codealmanac.com/wiki/github/<owner>/<repo>
```

The web app can redirect that route to the current internal dashboard route.
The CLI should not need to know account IDs, repository IDs, or future dashboard
route changes.

## `repo setup`

`codealmanac repo setup` is not a run command.

It should open the cloud setup page scoped to the current checkout:

```text
codealmanac repo setup
  -> detect git remote owner/repo
  -> open codealmanac.com/setup/repo?provider=github&owner=...&repo=...
```

That page should handle the relevant missing step:

```text
not signed in
no GitHub App installation
repo not granted to the app
repo connected but no maintained branches
repo connected but no delivery policy
ready
```

Terminal commands that open external configuration are acceptable as URL
shortcuts:

```text
codealmanac repo open
codealmanac repo open settings
codealmanac repo open github
codealmanac repo open github-app
```

These commands should open URLs. They should not mutate cloud policy directly
unless the verb says so.

## Public Local Surface

Do not expose `ingest` or `garden` as launch public commands.

Keep ingest and garden as internal engine operations. Public local maintenance
should be:

```text
codealmanac local update
```

`local update` means: select local sources for the current repo/branch, run the
local update engine, and deliver according to local delivery policy.

## Local Setup And Detection

Reading should work without local setup when a wiki exists in the repo.

Local setup is required for local maintenance:

```text
codealmanac local setup
```

Local setup should:

- detect the Git repo root
- detect the initialized wiki root by the committed wiki markers
- create the wiki if the user asks for local initialization
- register the repo in the local control DB
- record local branches when triggers are enabled
- install local Git hook dispatchers
- configure local capture only when requested

The local control DB should not silently track every repo on disk. A repo enters
local maintenance when the user runs `local setup` or enables a local trigger.

If cloud setup already delivered a wiki into the repo, local read commands can
use it immediately. Local automatic updates still require explicit local setup.

## Auto Update

The CLI should auto-update without prompting.

It should not replace the currently running process. The safe behavior is:

```text
current command runs with installed version
background updater checks/releases after command start or exit
next command uses the updated version
```

`codealmanac update` can remain as an explicit repair/debug command, but normal
users should not need to run it.

Implementation should research existing Python CLI auto-update libraries before
writing custom update machinery. The launch requirement is product behavior,
not a requirement to hand-roll the updater.

## CLI Is Not The Worker API

The model/worker should not use the public human CLI directly.

Correct layering:

```text
human CLI
  -> service/API layer
  -> engine request/result contract
  -> update engine

cloud worker
  -> service/API layer or private machine entrypoint
  -> engine request/result contract
  -> update engine

local worker
  -> service/API layer or private machine entrypoint
  -> engine request/result contract
  -> update engine
```

The public CLI is a UX surface. It can call the same underlying service layer,
but it should not be the automation contract for cloud workers, local workers,
or model containers.

If a process boundary is needed, use a private machine entrypoint with a typed
request/result file contract. Do not make cloud automation shell out to commands
such as `codealmanac local update` or old lifecycle verbs.
