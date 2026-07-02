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
codealmanac login
codealmanac logout
codealmanac whoami
```

`setup` opens browser onboarding, stores local cloud auth, installs local support
files, probes supported agent providers, and installs capture only after browser
consent says it should.

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
codealmanac capture enable
codealmanac capture disable
codealmanac capture repair
```

Capture installation is explicit. CLI install must never silently install
Codex/Claude hooks.

## Local

```text
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

## Hidden / Private

Internal entrypoints may keep `ingest`, `garden`, provider diagnostics, and
engine execution commands. They are not part of the public launch CLI.
