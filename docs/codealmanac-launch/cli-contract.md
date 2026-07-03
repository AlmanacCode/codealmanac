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
- Setup/status screens should match the OpenAlmanac terminal aesthetic exactly:
  reuse the hard-coded ANSI banner, white-to-silver gradient, blue/silver
  accents, diamond step markers, selection controls, and next-steps box from
  `/Users/rohan/Desktop/Projects/openalmanac/mcp/src/setup/tui.ts`. Do not
  replace this with a different figlet package, color theme, or generic prompt
  style.

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

Implemented in Slice 38:

```text
codealmanac
codealmanac open [--app-url URL] [--no-browser] [--json]
```

These commands do not require a stored CLI token. They detect the current
GitHub checkout and open `/wiki/github/<owner>/<repo>` on the hosted app.

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

`setup` is cloud-first and not repo-scoped. It logs in through WorkOS-backed CLI
Auth when needed, stores local auth state under `~/.codealmanac/auth.json`, and
installs local support files.

`setup` must feel like a CLI-led flow, not an abrupt browser redirect. It should
first render the OpenAlmanac-style banner and setup checklist, then ask before
opening the browser. The default interactive path is:

```text
Open browser to finish cloud setup? [Y/n]
```

If the user says yes, the CLI opens the WorkOS/browser setup URL, keeps polling
in the terminal, and resumes local setup automatically after the browser approves
the device session. If the user says no, or the process is non-interactive, the
CLI prints the setup URL and device code and waits/polls without opening a
browser.

This must be agent-friendly. Agents installing CodeAlmanac should be able to run
`codealmanac setup` in a non-interactive terminal, read the printed URL/code,
hand it to the human, and continue once the browser-side approval completes.
`--no-browser` should force this copy/paste mode. `--yes` may answer the setup
prompt, but must not silently open a browser in non-interactive contexts.

The browser completion page should say the user can return to the terminal; it
should not make "go to dashboard" the primary action for a CLI-initiated setup.

`setup --skip-login` is reserved for local-only support-file installation and
CI. It is not the default user path.

Browser onboarding, capture consent, provider probing, and repo configuration
remain dashboard/API work after this slice.

`setup` does not run a wiki update.

Implemented in Slice 59:

```text
codealmanac setup [--yes] [--no-browser] [--skip-login] [--skip-instructions]
codealmanac login [--no-browser] [--force]
```

Root setup is cloud setup only. It no longer exposes local scheduled automation
flags. Interactive setup asks before opening the browser; non-interactive setup
prints the verification URL and user code and polls without opening anything.
The workflow stores WorkOS-shaped `access_token` and optional `refresh_token`
fields while reading older `token` auth files for migration.

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

Implemented in Slice 36:

```text
codealmanac repo status
codealmanac repo triggers list
codealmanac repo triggers enable <branch> --delivery pr|commit
codealmanac repo triggers disable <branch>
codealmanac repo delivery set --branch <branch> --mode pr|commit
```

These commands resolve the current checkout's GitHub `origin`, authenticate
with the stored cloud CLI token, and call `/v1` cloud repository routes. Users
do not pass account IDs.

Implemented in Slice 38:

```text
codealmanac repo setup [--app-url URL] [--no-browser] [--json]
codealmanac repo open [activity|settings|github|github-app] [--app-url URL] [--no-browser] [--json]
```

These commands are browser handoffs and do not require a stored CLI token.
`repo open` defaults to `activity`. `repo open github` opens the GitHub
repository directly; the other targets open hosted resolver URLs and let the
browser dashboard handle account scope and onboarding state.

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

Implemented in Slice 37:

```text
codealmanac runs list
codealmanac runs show <run-id>
codealmanac runs logs <run-id>
```

`runs list` resolves the current checkout's GitHub `origin` before asking the
cloud for that repository's runs. `runs show` and `runs logs` use the run id and
do not need a current checkout.

Implemented in Slice 39:

```text
codealmanac runs start --branch <branch>
```

`runs start` resolves the current checkout's GitHub `origin`, authenticates
with the stored cloud CLI token, and asks the cloud to start a manual branch
run. The branch head is read by the hosted service from GitHub; the local
checkout SHA is not sent as source truth. The returned run is rendered through
the same detail view as `runs show`.

Implemented in Slice 44:

```text
codealmanac runs cancel <run-id>
```

`runs cancel` uses the run id and does not need a current checkout. The hosted
service authorizes the user through the run's repository, cancels queued runs in
SQL, cancels running runs through the stored Modal function-call id, marks the
run `cancelled`, records a run event, and returns the same detail view as
`runs show`.

Implemented in Slice 45:

```text
codealmanac runs retry <run-id>
```

`runs retry` uses the run id and does not need a current checkout. The hosted
service authorizes the user through the original run's repository, creates a
new run for `failed`, `stale`, or `cancelled` runs, rejects active and already
delivered runs, refreshes the current GitHub head, and returns the retried run
through the same detail view as `runs show`.

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

The hidden hook exits quickly and never runs the model. In Slice 29 it reads the
hook-provided transcript path, uploads the raw transcript bytes to the cloud
artifact endpoint with the stored `cap_...` credential, uploads normalized turn
routing metadata with `artifactRef`, then records one local event with
`upload_status`. Missing transcripts and upload failures are recorded locally
and still exit `0` so Codex/Claude work is not blocked.

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
