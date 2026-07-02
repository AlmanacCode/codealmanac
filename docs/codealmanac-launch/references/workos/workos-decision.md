# WorkOS decision

Status: current recommendation

Almanac should move hosted identity and access control fully onto WorkOS, even
if that means breaking the current Supabase account/member table shape.

## Why

The hosted product needs:

```text
Google/social login
enterprise SSO
organizations
memberships
invitations
roles
admin/member UI
agent authorization
resource-level access checks
future SCIM
future audit/security expectations
```

Those are not Almanac's product. Almanac's product is the wiki, source library,
and managed jobs. If we build orgs, invites, RBAC, and agent auth ourselves,
the codebase will drift away from the simple hosted product.

## Decision

Use WorkOS as source of truth for:

```text
users
organizations
organization memberships
invitations
roles
SSO
SCIM
AuthKit sessions
CLI auth
agent registration/auth
FGA access checks
organization-scoped API keys
```

Use Almanac DB for:

```text
wikis
pages
sources
jobs
job events
page-source provenance
WorkOS ids needed for joins
```

Do not keep a parallel Almanac membership system unless it is only a cache of
WorkOS ids and is clearly named as a mirror.

Hard rule: do not build a local source-of-truth copy of WorkOS auth,
organization, membership, invitation, role, or permission state. Almanac should
ask WorkOS at the access boundary and store only product-owned rows plus stable
WorkOS ids needed to join product data.

Do not add WorkOS webhooks just to synchronize auth or membership state into
Almanac. If a future feature needs a derived cache for latency or UX, that
cache must be explicitly approved and named as derived data, not truth.

## Consequence

Current tables such as `accounts`, `account_members`, and `wiki_members` are not
sacred. They can be renamed, removed, or reduced to mirrors once the WorkOS
integration shape is implemented.

Prior hosted data is disposable during this migration. We should not keep an
awkward schema, compatibility path, or auth boundary just to preserve current
development rows. If deleting current Supabase data makes the WorkOS-backed
product cleaner, delete it and reseed.

The migration priority is:

```text
correct product model
simple names
clear source of truth
easy-to-read services and stores
fresh seed data
```

Historical development data is not a constraint.
