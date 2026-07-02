# CLI Contract

Status: active.

This is the public CLI surface for the launch design. The top-level experience is
cloud-first. The local product is explicit under `local`.

## Principles

- `codealmanac setup` means cloud setup.
- `codealmanac local setup` means local setup.
- `repo` is the namespace; do not also add `repos`.
- `capture` is the noun for Codex/Claude conversation capture.
- Public commands should not expose `ingest` or `garden`.
- Public commands are human UX, not the worker API.
- Commands that mirror browser settings should still be useful from terminals
  and agents.

## Open / Read

```text
codealmanac
codealmanac open
codealmanac search <query>
codealmanac show <slug>
codealmanac topics
codealmanac health
codealmanac serve
```

`codealmanac` and `codealmanac open` resolve the current checkout's GitHub
remote and open the cloud wiki route. The browser owns the final redirect.

## Cloud Setup And Identity

```text
codealmanac setup
codealmanac status
codealmanac login [--api-url URL] [--no-browser] [--timeout SECONDS] [--poll-every SECONDS] [--force]
codealmanac whoami [--api-url URL]
codealmanac logout [--api-url URL]
```

Implemented in Slice 27:

```text
codealmanac setup
codealmanac login
codealmanac whoami
codealmanac logout
```

`setup` is cloud-first and not repo-scoped. It logs in through the hosted
browser flow when needed, stores the issued CLI token under
`~/.codealmanac/auth.json`, and installs local support files.

`setup --skip-login` is reserved for local-only support-file installation and
CI. It is not the default user path.

Browser onboarding, capture consent, provider probing, and repo configuration
remain dashboard/API work after this slice.

`setup` does not run a wiki update.

## Cloud Repo Configuration

```text
codealmanac repo list
codealmanac repo status
codealmanac repo setup
codealmanac repo open
codealmanac repo open settings
codealmanac repo open github
codealmanac repo open github-app
codealmanac repo triggers list
codealmanac repo triggers enable <branch> --delivery pr|commit
codealmanac repo triggers disable <branch>
codealmanac repo delivery set --branch <branch> --mode pr|commit
```

`repo setup` is repo-scoped cloud setup. It uses the current checkout's GitHub
remote to open the matching browser setup page. It does not run an update.

Trigger policy is branch-scoped. Delivery mode is configured per maintained
branch.

## Cloud Runs

```text
codealmanac runs list
codealmanac runs show <run-id>
codealmanac runs logs <run-id>
codealmanac runs cancel <run-id>
codealmanac runs retry <run-id>
codealmanac runs start --branch <branch>
```

Cloud uses `runs` because execution happens in the cloud control plane.

## Cloud Capture

```text
codealmanac capture status
codealmanac capture status [--json] [--check-cloud] [--api-url URL]
codealmanac capture enable [--target all|codex|claude] [--json] [--api-url URL]
codealmanac capture repair [--target all|codex|claude] [--json] [--api-url URL]
codealmanac capture disable [--target all|codex|claude] [--keep-credential] [--json] [--api-url URL]
```

Capture installation is explicit. CLI install must never silently install
Codex/Claude hooks.

Implemented in Slice 28:

```text
codealmanac capture status
codealmanac capture enable
codealmanac capture repair
codealmanac capture disable
codealmanac __capture-hook --provider codex|claude
```

`enable` requires cloud login, issues a narrow hosted `cap_...` capture
credential, stores it in `~/.codealmanac/capture.json` mode `0600`, and
installs selected provider Stop hooks. `status` is local by default and only
calls the cloud when `--check-cloud` is passed. `disable` removes selected hooks
and revokes the stored credential unless `--keep-credential` is passed.

The hidden hook records a local diagnostic event and exits quickly. It does not
upload transcripts or run the model in Slice 28.

## Local

```text
codealmanac init [path] --using codex|claude [--background|--foreground] [--force]
codealmanac local setup
codealmanac local status
codealmanac local update
codealmanac local triggers list
codealmanac local triggers enable <branch> --delivery working-tree|commit
codealmanac local triggers disable <branch>
codealmanac local delivery set --branch <branch> --mode working-tree|commit
codealmanac local jobs list
codealmanac local jobs show <job-id>
codealmanac local jobs logs <job-id>
```

Local uses `jobs` because execution happens on the user's machine.

`init` is the local first-build lifecycle command. It creates or refreshes the
configured Almanac root, installs manual files, runs the init prompt through the
shared page-run lifecycle, records a local run, and refreshes the read index.
It refuses populated wikis unless `--force` is passed. `init --background`
queues a durable job and starts the same hidden worker used by other local
lifecycle jobs.

`local setup` detects the current GitHub checkout, stores the repository and
selected branch policy in `~/.codealmanac/control.sqlite`, and installs local
Git trigger hooks unless `--skip-hooks` is passed. The default delivery mode is
`commit`; `working-tree` is the explicit no-commit mode.

`local update` runs the local update pipeline now for the current checkout and
current branch. The branch must already be configured by `local setup`.

The command records a `manual` trigger event for the current HEAD, then runs the
same local worker path used by Git hooks: source bundle, shared engine, and
local delivery. Manual update can rerun on the same HEAD after a completed job
because source/capture material can change without a code commit. It refuses to
start when the branch already has a queued or running local job.

`local triggers list|enable|disable` and `local delivery set` mutate branch
policy rows in the local control DB for the current checkout's configured
repository. They do not install hooks, spawn workers, or run updates.

`local triggers enable <branch>` preserves the existing delivery mode when the
branch row already exists and `--delivery` is omitted; otherwise it defaults to
`commit`. `local triggers disable <branch>` preserves the existing delivery mode.
`local delivery set --branch <branch> --mode ...` requires an existing branch
policy row and preserves the branch trigger state.

## Hidden / Private

Internal entrypoints may keep provider diagnostics and engine execution
commands.

```text
codealmanac dev ingest <inputs...>
codealmanac dev garden
```

`dev` is a hidden maintenance namespace. It is not shown in normal top-level
help. `dev ingest` and `dev garden` keep the existing local lifecycle behavior
reachable for maintainers and agents without teaching those verbs as launch
commands.
