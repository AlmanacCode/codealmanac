# Target architecture

Status: implementation target

## Request path

```text
frontend or CLI
  -> hosted API bearer credential
  -> authenticate actor through WorkOS
  -> resolve org/wiki target
  -> authorize product action
  -> execute Almanac service
  -> read/write Almanac product DB
```

## Actors

Almanac should treat every caller as an actor:

```text
human user
CLI session
agent registration
organization API key
internal worker callback
```

Actor fields:

```text
actor_id
actor_type
workos_user_id
workos_agent_registration_id
workos_organization_id
workos_organization_membership_id
permissions or scopes
```

Do not use raw Supabase user id as hosted identity after migration.

## Authorization layers

Layer 1: Authentication

```text
WorkOS validates user/session/agent/API key
```

Layer 2: Organization-wide authorization

```text
check AuthKit/JWT organization-scoped permissions
```

Layer 3: Resource authorization

```text
call WorkOS FGA Authorization API with organizationMembershipId
```

Layer 4: Product invariants

```text
wiki exists
source belongs to wiki
job belongs to wiki
page belongs to wiki
job status transition is legal
```

Only layer 4 is pure Almanac logic.

## Service boundary

Add one access service:

```text
access.authenticate(token) -> Actor
access.require(actor, action, resource) -> None
```

Product services should not import WorkOS directly:

```text
wikis.create(...)
sources.upload(...)
jobs.garden(...)
pages.search(...)
```

The composition root wires WorkOS-backed access into hosted services.

## Storage boundary

Almanac DB stores:

```text
wikis.organization_id
wikis.slug
sources/wiki/page/job product rows
optional WorkOS resource ids
optional cached display names
```

Almanac DB does not own:

```text
membership truth
invite truth
role truth
SSO connection truth
agent credential truth
```

## FGA resource split

Start with:

```text
organization resource
wiki resource
```

Keep local, protected through wiki:

```text
pages
sources
jobs
topics
```

Promote individual pages/sources to FGA resources only if the product gains
per-page or per-source sharing.
