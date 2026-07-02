# Almanac migration notes

## Current shape

The hosted Supabase schema currently has local account/membership concepts:

```text
accounts
account_members
wiki_members
wikis.account_id
```

The current CLI also stores a selected `wiki_id`, not an `org/wiki` target.

## Target shape

Hosted Almanac should move toward:

```text
wikis.organization_id = WorkOS organization id
actor identity = WorkOS user/agent identity
membership/role = WorkOS
authorization = WorkOS FGA
```

Almanac stores product data:

```text
wikis
pages
sources
source_import_batches
jobs
job_events
page_sources
```

## Backend boundary

Add an access boundary rather than checking WorkOS in every service:

```text
Hosted request
  -> authenticate actor
  -> resolve organization/wiki
  -> authorize action
  -> call product service
```

Services should stay product-oriented:

```text
wikis.create(...)
sources.upload(...)
jobs.garden(...)
pages.search(...)
```

## CLI boundary

The CLI should store:

```text
api_url
actor/session token
organization_slug
wiki_slug
wiki_id
target = org/wiki
```

`almanac use reverie/legal` should select a WorkOS organization plus Almanac
wiki target.

## Breakage accepted

Breaking changes are acceptable if they make access clearer:

```text
remove local account source of truth
rename account -> organization
remove direct account_members writes
replace wiki_members with FGA-backed checks
replace custom CLI token minting if WorkOS CLI auth fits
```

## Membership id is load-bearing

WorkOS FGA with AuthKit expects organization membership id for resource-scoped
checks. Almanac should carry it through request context:

```text
actor.organization_membership_id
```

Do not design FGA around raw user id.
