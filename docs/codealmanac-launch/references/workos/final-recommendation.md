# Final WorkOS recommendation

Status: implementation-ready direction

## Recommendation

Move hosted Almanac access control completely to WorkOS.

Use WorkOS as source of truth for:

```text
human identity
AuthKit sessions
organizations
organization memberships
invitations
roles and permissions
CLI/device auth
agent registration
organization API keys
FGA access checks
SSO/SCIM enterprise readiness
```

Use Almanac as source of truth for:

```text
wikis
pages
topics
sources
source batches
jobs
job events
page-source provenance
wiki/source/job product invariants
```

## Code changes required

Replace current local access ownership:

```text
Supabase auth as identity source
accounts as org source
account_members as membership source
wiki_members as wiki access source
cli_tokens as independent CLI auth source
```

With:

```text
WorkOS actor authentication
WorkOS organization ids
WorkOS organization membership ids
WorkOS FGA for wiki-level permissions
WorkOS CLI Auth or WorkOS-backed narrow Almanac token
WorkOS Agent Registration/API keys for agents
```

## DB direction

Break current schema if needed.

Changing the database architecture is allowed and encouraged when it improves
the product boundary. Current hosted data can be deleted and reseeded; do not
carry confusing tables forward for data-preservation reasons.

Target product shape:

```text
wikis.organization_id = WorkOS organization id
wikis.slug unique per organization_id
pages/wiki/source/job rows stay Almanac-owned
no local invite/role/membership source of truth
```

Keep local mirror tables only if they are named and treated as mirrors.

Default stance: avoid mirror tables. WorkOS is queried as the source of truth
for auth and access. A local mirror/cache is allowed only after a concrete
latency, audit, or UX need is proven and explicitly approved.

## API direction

Add one access boundary:

```text
authenticate actor
resolve org/wiki
authorize action
run product service
```

Do not put role checks directly in route handlers or product services.

Preferred API context response:

```json
{
  "organization_id": "org_...",
  "organization_slug": "reverie",
  "organization_membership_id": "om_...",
  "wiki_id": "wiki_...",
  "wiki_slug": "legal",
  "target": "reverie/legal"
}
```

## Frontend direction

Use WorkOS/AuthKit and widgets for:

```text
hosted sign-in
hosted sign-up
organization switching
user management
user profile
API keys
user sessions
user security
SSO setup
Directory Sync setup
audit log streaming setup
```

Use Almanac UI for:

```text
wiki selection
wiki pages
source library
jobs
garden/upload actions
```

## CLI direction

Use WorkOS CLI Auth for `almanac login` if implementation confirms it fits.

Do not copy browser refresh tokens.

CLI keeps product context:

```text
organization_slug
organization_id
organization_membership_id
wiki_slug
wiki_id
target = org/wiki
```

## Agent direction

Use WorkOS Agent Registration and/or organization API keys.

Default security posture:

```text
service_auth for user-bound coding agents
organization API keys for headless automation
anonymous only for limited exploration
no anonymous upload
no anonymous job execution
```

## FGA direction

Manage WorkOS FGA resources for:

```text
organization
wiki
```

Keep high-cardinality product rows local:

```text
pages
sources
jobs
topics
```

Authorize those through the nearest wiki-level FGA-managed parent unless
per-page or per-source sharing becomes a real product feature.

## First implementation slice

1. Add WorkOS config and SDK boundary.
2. Add `HostedActor` and `HostedAccess`.
3. Replace Supabase session lookup in hosted services with WorkOS-backed actor
   authentication.
4. Add org/wiki resolver carrying `organization_membership_id`.
5. Keep product services on `wiki_id` after resolution.
6. Move frontend login to WorkOS/AuthKit.
7. Move CLI login to WorkOS CLI Auth or WorkOS-backed narrow token.
8. Stop writing `account_members` and `wiki_members`.
9. Migrate `wikis.account_id` to WorkOS organization ownership.
10. Add FGA checks at the access boundary.

## What would change this

Only a concrete WorkOS limitation should change this direction:

```text
CLI Auth cannot support installed CLI use
Agent Registration cannot support our agent flows
FGA latency/cost is unacceptable even with wiki-level resources
Widgets cannot satisfy basic org/member UI needs
```

If one of those happens, still keep WorkOS as upstream identity/org source and
let Almanac mint only narrow downstream product tokens.
