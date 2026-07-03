# GitHub Webhook Contract Hardening Implementation Plan

Status: planned research artifact. Use as the starting point before changing
GitHub webhook intake again.

**Goal:** Make hosted CodeAlmanac's GitHub webhook intake match GitHub's event schemas for the webhook families we depend on, without adding reconciliation or a parallel sync path.

**Architecture:** Route webhook parsing by `X-GitHub-Event`, normalize supported payloads into typed Pydantic messages, and audit unsupported payloads as ignored. Control-plane messages carry the parent provider facts they need; fanout subscribers keep owning their own tables.

**Tech Stack:** FastAPI, SQLModel, Pydantic, GitHub App webhooks, Octokit generated webhook schemas for research.

---

## Research Baseline

Checked on 2026-07-03:

- GitHub docs: `https://docs.github.com/en/webhooks/webhook-events-and-payloads`
- GitHub Apps webhook docs: `https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/using-webhooks-with-github-apps`
- `@octokit/webhooks-schemas@7.6.1`: 66 top-level event families, 224 action variants.
- `@octokit/webhooks-examples@7.6.1`: current dotcom examples for 58 event families.

The current backend supports only these event families:

```text
installation
installation_repositories
repository
push
pull_request
```

That scope is correct for launch. The bug is not that we ignore most GitHub events; the bug is that the mapper currently guesses by payload shape instead of using `X-GitHub-Event`, and the `installation` action names do not match the schema.

## Important Schema Findings

`installation` actions are:

```text
created
deleted
new_permissions_accepted
suspend
unsuspend
```

Current code checks `suspended` and `unsuspended`, which is wrong.

`installation_repositories` actions are:

```text
added
removed
```

Each payload includes:

```text
installation
repository_selection
repositories_added
repositories_removed
requester
sender
```

The `installation.account` object is present there, so the mapper can produce `AccountSnapshot` and `InstallationSnapshot` for delta events without calling GitHub again.

Most repository-scoped events include these optional or required top-level objects:

```text
installation
repository
organization
sender
```

That does not mean CodeAlmanac should persist every event. It means the webhook edge should route by event name, validate only supported families, and record unsupported families as ignored.

## Out Of Scope

- No login-time GitHub reconciler.
- No background reconciler.
- No broad "sync all installations" repair job.
- No runtime dependency on Node or Octokit.
- No modeling all 66 GitHub webhook families as Python messages.
- No subscription expansion unless product work needs the event.

## Target Shape

```python
message = github_webhooks.parse_github_message(event_name, payload)

match event_name:
    case "installation":
        return parse_installation(payload)
    case "installation_repositories":
        return parse_installation_repositories(payload)
    case "repository":
        return parse_repository(payload)
    case "push":
        return parse_push(payload)
    case "pull_request":
        return parse_pull_request(payload)
    case _:
        return None
```

Supported control-plane messages carry parent snapshots:

```python
InstallationRepositoriesAdded(
    account=AccountSnapshot(...),
    installation=InstallationSnapshot(...),
    repository_selection="selected",
    repositories=[...],
)
```

Identity fanout handles the parent rows:

```python
identity.on_installation_repositories_added(message):
    accounts.upsert(message.account)
    installations.upsert(message.installation)
```

Repository fanout handles repository scope only:

```python
repositories.on_installation_repositories_added(message):
    repository_scope.sync_installation(message.installation.installation_id)
```

## Implementation Tasks

### Task 1: Route Parsing By GitHub Event Header

**Files:**

- Modify: `backend/src/almanac/services/github/service.py`
- Modify: `backend/src/almanac/services/github/webhooks.py`
- Test: `backend/tests/test_github_service_contract.py`

Steps:

1. Change `GitHubService.handle_webhook` to call `parse_github_message(event, payload)`.
2. Replace shape-sniffing in `map_payload(payload)` with event-name dispatch.
3. Keep unsupported event families returning `None`.
4. Add tests showing unsupported `check_run` / `check_suite` remain ignored.
5. Add a regression test showing a payload with both `repository` and `installation` is routed by event name, not shape.

### Task 2: Correct Installation Action Contract

**Files:**

- Modify: `backend/src/almanac/services/github/webhooks.py`
- Modify: `backend/src/almanac/services/github/webhook_messages.py`
- Test: `backend/tests/test_github_service_contract.py`

Steps:

1. Accept `suspend` and `unsuspend`.
2. Stop accepting non-schema `suspended` and `unsuspended`.
3. Map `suspend` to `InstallationSuspended`.
4. Map `unsuspend` to `InstallationUnsuspended`.
5. Ignore `new_permissions_accepted` unless product behavior requires it later.

### Task 3: Carry Parent Snapshots On Installation Repository Deltas

**Files:**

- Modify: `backend/src/almanac/messages/github.py`
- Modify: `backend/src/almanac/services/github/webhook_messages.py`
- Modify: `backend/src/almanac/wiring/fanout/identity.py`
- Test: `backend/tests/test_installations_contract.py`
- Test: `backend/tests/test_github_service_contract.py`

Steps:

1. Add `account: AccountSnapshot` and `installation: InstallationSnapshot` to `InstallationRepositoriesAdded`.
2. Add the same fields to `InstallationRepositoriesRemoved`.
3. Populate those snapshots from `installation.account` and `installation.id`.
4. Subscribe identity fanout to both delta message types.
5. Upsert account and installation in identity fanout before repository fanout syncs repositories.
6. Keep repository fanout focused on `RepositoryScope`.

### Task 4: Add Schema Guardrails For Supported Families

**Files:**

- Modify: `backend/tests/test_github_service_contract.py`
- Optional create: `backend/tests/fixtures/github_webhooks/README.md`

Steps:

1. Add compact fixture payloads for the five supported event families.
2. Include action coverage for:
   - `installation.created`
   - `installation.deleted`
   - `installation.suspend`
   - `installation.unsuspend`
   - `installation_repositories.added`
   - `installation_repositories.removed`
   - `repository.renamed`
   - `repository.transferred`
   - `repository.deleted`
   - `push`
   - supported `pull_request` actions
3. Assert ignored actions are audited as ignored, not invalid.
4. Assert malformed supported payloads are audited as invalid.

### Task 5: Update Launch Docs

**Files:**

- Modify: `docs/codealmanac-launch/worklog.md`
- Modify: `docs/codealmanac-launch/progress.md`
- Modify: `docs/codealmanac-launch/verification-matrix.md`
- Modify: `docs/codealmanac-launch/next-agent-brief.md`
- Optional modify: `docs/codealmanac-launch/auth-api-contract.md`

Steps:

1. Record the schema inventory result.
2. Record that reconciliation remains out of scope.
3. Record that webhook parsing is event-header routed.
4. Update percentages only after tests and deployment.

## Verification

Run in hosted repo:

```bash
cd /Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence
uv run pytest backend/tests/test_github_service_contract.py backend/tests/test_installations_contract.py -q
uv run pytest backend/tests/test_repositories_contract.py backend/tests/test_wiki_contract.py -q
uv run ruff check backend/src backend/tests
```

If backend changes pass, deploy hosted backend/frontend together only after the coherent slice is complete.

## Decision Check

This plan fixes real contract drift and the DB-wipe webhook edge without making DB wipe a supported product workflow. If we later want first-class repair, that should be a separate reconciler design with explicit product semantics.
