# Migration plan

Status: proposed phased implementation

## Phase 1: Add WorkOS boundary without deleting product behavior

Add interfaces:

```text
HostedAccess
HostedActor
HostedOrganization
HostedMembership
```

Add a WorkOS-backed implementation behind those interfaces.

Keep current Supabase tables temporarily, but stop adding new product behavior
to `accounts`, `account_members`, or `wiki_members`.

## Phase 2: Move frontend auth to AuthKit

Replace:

```text
frontend Supabase auth client
Supabase Google OAuth login
```

With:

```text
WorkOS/AuthKit login
WorkOS organization switcher
WorkOS user/session/security widgets where useful
```

Frontend product state should use:

```text
organization
wiki
target = org/wiki
```

## Phase 3: Move CLI auth

Replace custom CLI auth with:

```text
WorkOS CLI Auth device flow
```

If direct WorkOS tokens cannot call Almanac cleanly, Almanac can mint a narrow
backend token after WorkOS auth. That token must remain downstream of WorkOS,
not a second identity source.

## Phase 4: Move organizations and memberships

Replace local account ownership:

```text
accounts -> WorkOS organizations
account_members -> WorkOS organization memberships
wiki_members -> WorkOS FGA role assignments, only where resource-scoped access is needed
```

Update `wikis`:

```text
account_id -> organization_id
organization_id = WorkOS organization id
unique(organization_id, slug)
```

## Phase 5: Add FGA authorization

Protect API actions through one access service.

Initial action map:

| Product action | WorkOS/FGA check |
| --- | --- |
| list wikis | organization membership |
| create wiki | organization permission |
| read wiki/page/search | `read_wiki` on wiki |
| upload source | `upload_source` on wiki |
| download source | `download_source` on wiki |
| garden/ingest job | `run_job` on wiki |
| view jobs | `read_jobs` on wiki |
| manage members | organization permission / WorkOS widget |
| billing | organization billing permission / Autumn |

## Phase 6: Agent auth

Enable WorkOS Agent Registration.

Support:

```text
service_auth for user-bound coding agents
organization API keys for headless org automation
anonymous only for limited exploration if we intentionally allow it
```

Default:

Do not grant anonymous agents source upload or job execution.

## Phase 7: Remove local membership source of truth

Delete or archive:

```text
local account membership writes
local wiki membership writes
custom invite/role logic
custom browser-token copying
```

Keep only product tables and WorkOS id mirrors needed for joins.
