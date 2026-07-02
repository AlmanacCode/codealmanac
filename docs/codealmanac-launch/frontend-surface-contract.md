# Frontend Surface Contract

Status: active.

The browser owns product onboarding, account policy, GitHub App setup, repo
selection, trigger policy, delivery policy, billing, and capture consent. The CLI
owns local machine installation and local status.

The launch frontend starts from the current `../usealmanac/frontend` product.
The visual feel should remain the same while internals, routes, and names may be
refactored for CodeAlmanac.

## Onboarding

Cloud onboarding should happen before the CLI performs local capture setup. If a
user is already onboarded, the frontend should skip onboarding and return the
user to the relevant dashboard state.

Required onboarding steps:

1. Sign in with the cloud product.
2. Connect or select the GitHub account/organization.
3. Install or verify the GitHub App.
4. Select repositories.
5. Choose maintained branches.
6. Choose delivery mode for each maintained branch.
7. Consent to Codex/Claude capture.
8. Show billing or plan requirements when needed.
9. Return a machine-readable setup result to the CLI.

## Primary Routes

```text
/setup
/setup/repo?provider=github&owner=<owner>&repo=<repo>
/wiki/github/<owner>/<repo>
/dashboard/repositories
/dashboard/repositories/<repo-id>
/dashboard/repositories/<repo-id>/runs
/dashboard/repositories/<repo-id>/settings
/dashboard/repositories/<repo-id>/settings/triggers
/dashboard/repositories/<repo-id>/settings/capture
/dashboard/repositories/<repo-id>/settings/github
/dashboard/billing
```

The exact route names may change, but these surfaces must exist.

`/wiki/github/<owner>/<repo>` is the stable resolver that bare `codealmanac`
can open. The frontend can redirect it to the actual dashboard route.

## Repo Settings

Each maintained branch has one policy row:

```text
branch
enabled
trigger event
delivery mode
```

Cloud launch delivery modes are `pr` and `commit`.

## Status States

The frontend should expose these states because the CLI will mirror them:

```text
not signed in
github account disconnected
github app missing
repo not selected
no maintained branches
delivery not configured
capture consent missing
capture installed
capture needs repair
ready
```

## CLI Mirror

Browser actions should have terminal equivalents where useful:

```text
setup page                 -> codealmanac setup
repo setup page            -> codealmanac repo setup
repo dashboard             -> codealmanac repo open
trigger list               -> codealmanac repo triggers list
trigger enable/disable     -> codealmanac repo triggers enable/disable
delivery edit              -> codealmanac repo delivery set
capture status/repair      -> codealmanac capture status/repair
run list/logs              -> codealmanac runs list/logs
```

The CLI should open browser pages for setup-heavy flows instead of reimplementing
the full product UI.
