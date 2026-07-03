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
user to the relevant setup continuation.

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

When onboarding is started by `codealmanac setup`, the browser is a step inside a
CLI-led flow. The success page should say that setup is complete in the browser
and that the user can return to the terminal. A dashboard link can exist as a
secondary action, but the primary action must not be "Continue to dashboard".
The CLI remains open, polls for completion, stores auth, installs local support
files, and prints the final next steps.

The frontend must support agent-mediated setup. The CLI may be running in a
non-interactive agent terminal, so browser setup URLs and device codes must be
copyable and stable enough for an agent to present to a human. Browser-side
completion should not assume that the same process opened the browser.

Slice 28 allows `codealmanac capture enable` to issue a capture credential when
the user is already signed in and the API authorizes it. Browser onboarding
still owns first-time capture consent, dashboard revocation, and account/repo
policy.

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

Implemented in Slice 38:

```text
/wiki/github/<owner>/<repo>
/setup/repo?provider=github&owner=<owner>&repo=<repo>&target=activity|settings|github|github-app|wiki
```

Both are redirector routes. They use browser auth, resolve `owner/repo` through
the backend, and redirect into the existing account-scoped dashboard routes.
`target=github` redirects directly to the GitHub repository. `target=github-app`
resolves the account and redirects to GitHub's installation settings page.

Implemented in Slice 50:

```text
/setup
```

`/setup` is the browser-owned cloud setup hub. It requires a WorkOS/AuthKit
browser session, presents GitHub App installation when needed, lists connected
GitHub accounts when available, and shows the public installer command:

```text
curl -fsSL https://www.codealmanac.com/install.sh | sh
codealmanac setup
```

For CLI-initiated setup, `/setup` must preserve a session/device context and end
on a "return to terminal" completion state instead of redirecting into the normal
dashboard onboarding path.

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
