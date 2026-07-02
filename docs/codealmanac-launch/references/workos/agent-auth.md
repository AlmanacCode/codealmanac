# Agent auth

Status: research target

WorkOS has official documentation for agent registration and agent credential
validation. This matters for Almanac because agents need to:

```text
query a wiki
upload files
start managed jobs
watch jobs
possibly operate inside an organization context
```

## Desired Almanac behavior

Human flow:

```bash
almanac login
almanac whoami
```

Agent flow:

```bash
almanac login
almanac use reverie/legal
almanac upload docs/
almanac search "yc safe"
```

The CLI should not copy browser refresh tokens. It should use a proper
provider-backed CLI or agent auth flow.

## WorkOS docs to inspect first

- AuthKit CLI auth
- AuthKit agent registration
- AuthKit API keys
- Agents validate credential
- FGA checks

Relevant official URLs are listed in `source-index.md` under:

```text
authkit - cli-auth
authkit - agent-registration
authkit - api-keys
agents - validate-credential
fga - access-check
AuthKit Agent Registration
```

## Current hypothesis

Use WorkOS for:

```text
human browser auth
CLI device auth
agent registration
agent credential validation
organization-bound credentials
```

Almanac then converts a validated WorkOS identity into product checks:

```text
can_read_wiki
can_upload_source
can_run_job
can_manage_wiki
```

Open implementation question:

Should the CLI token be a WorkOS token directly, or should Almanac mint a narrow
backend token after a WorkOS CLI/device flow? Prefer WorkOS direct if the API
shape supports it cleanly.

## Likely flows

Human CLI login:

```text
almanac login
  -> WorkOS CLI Auth device authorization
  -> browser verification
  -> CLI receives token material
  -> Almanac stores provider-backed CLI auth state
```

Agent registration:

```text
agent starts registration
  -> WorkOS claim ceremony
  -> human approves in browser
  -> agent receives credential
  -> Almanac validates credential before API work
```

Organization-scoped API key:

```text
organization admin creates key
  -> agent uses key for headless upload/search
  -> Almanac validates key through WorkOS
  -> Almanac checks FGA/action on target wiki
```
