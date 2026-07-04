---
title: Cloud CLI Reference Rewrite
---

# Cloud CLI Reference

The cloud CLI commands are the local terminal surface for CodeAlmanac's hosted product. They let a developer sign in to CodeAlmanac Cloud, connect the current repository to the hosted service, configure capture hooks for Codex or Claude conversations, inspect hosted update runs, and open the matching cloud or GitHub pages from the terminal. Unlike repo-local wiki commands such as `search`, `show`, or `serve`, these commands do not read the local Almanac index as their main source of truth. They call the cloud API, use stored cloud credentials, or open cloud application URLs.

## Command Families

The cloud surface is split into five command families.

| Family | Commands | Purpose |
| --- | --- | --- |
| Authentication | `login`, `whoami`, `logout` | Manage the local CLI token used for cloud API calls. |
| Capture | `capture status`, `capture enable`, `capture repair`, `capture disable` | Install, verify, repair, or remove conversation capture hooks for Codex and Claude. |
| Repository | `repo list`, `repo setup`, `repo open`, `repo status` | Discover cloud repositories and connect the current checkout to hosted CodeAlmanac. |
| Trigger and delivery policy | `repo triggers ...`, `repo delivery ...` | Configure which branches start cloud updates and whether delivery happens by commit or pull request. |
| Runs | `runs list`, `runs start`, `runs show`, `runs cancel`, `runs retry`, `runs logs` | Inspect and control hosted update runs. |

## Authentication

`login` starts the browser-based cloud sign-in flow. By default it uses the public CodeAlmanac API URL, opens a browser, waits up to 120 seconds, and polls every 2 seconds for approval. `--no-browser` prints the login URL without opening it, which is useful in remote shells. `--force` starts a fresh login even if a token is already present.

`whoami` validates the stored token against the cloud API and prints the signed-in identity. `logout` removes the local cloud token and signs the token out through the cloud API when possible.

All three commands accept `--api-url`, so development and production cloud endpoints can use the same CLI surface.

## Capture

The `capture` commands manage local hooks that send Codex or Claude conversation material to CodeAlmanac Cloud. `capture enable` creates or uses a cloud capture credential, writes local capture state, and installs provider hooks. `capture status` reports whether the local credential and provider hooks are present; with `--check-cloud`, it also validates the remote credential state. `capture repair` re-applies the local hook setup. `capture disable` removes hooks and normally revokes the cloud credential, while `--keep-credential` removes local hooks without revoking the credential.

Capture targets are `all`, `codex`, and `claude`. The hidden `__capture-hook` command is not a user command; it is the provider hook entrypoint invoked by Codex or Claude.

## Repository Commands

The `repo` commands are scoped to the current checkout when the command needs repository context. `repo list` lists cloud repositories through the API and supports pagination with `--limit` and `--cursor`. `repo setup` opens the hosted setup page for the current repository. `repo open` opens one of the repository's hosted or GitHub destinations: `activity`, `settings`, `github`, or `github-app`. `repo status` reads the current repository's cloud status.

These commands are the bridge between local Git context and hosted CodeAlmanac state. They do not create a local wiki by themselves; they connect or inspect the cloud representation of a repository.

## Trigger And Delivery Policy

`repo triggers list` shows branch trigger policies. `repo triggers enable <branch> --delivery commit|pr` enables cloud updates for a branch and chooses how updates are delivered. `repo triggers disable <branch>` turns off cloud updates for that branch.

`repo delivery set --branch <branch> --mode commit|pr` changes the delivery mode for an existing branch policy. `commit` means cloud updates can be written directly according to the cloud workflow. `pr` means updates are delivered through a pull request path.

## Runs

The `runs` commands operate on hosted update runs. `runs list` shows recent runs and supports pagination. `runs start --branch <branch>` starts a run for a branch. `runs show <run_id>` reads one run. `runs logs <run_id>` prints its log. `runs cancel <run_id>` stops a queued or running run when the cloud service allows it. `runs retry <run_id>` starts a retry path for a previous run.

This command family is operational: it is for seeing what the hosted system did, debugging a failed update, or manually starting work that would otherwise be trigger-driven.

## Shared Flags

Most API-backed cloud commands accept `--api-url` and `--json`. `--api-url` selects the cloud API endpoint. `--json` makes the command suitable for scripts and tests. Browser-opening commands use app URL and browser-control flags instead, because their job is to hand the user to the hosted web interface rather than fetch API data.

## Relationship To Local Wiki Commands

Cloud CLI commands and local wiki commands use the same installed CLI, but they answer different questions. Local commands read or maintain a repo-owned Almanac root. Cloud commands authenticate with CodeAlmanac Cloud, manage hosted repository state, upload or inspect captured source material, and control hosted update runs. The boundary matters because a cloud command can succeed or fail based on account state, cloud credentials, repository registration, or remote run status, even when the local wiki files are unchanged.
