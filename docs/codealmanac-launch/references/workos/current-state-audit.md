# Current Almanac state audit

Status: current code evidence

This records the access-control shape that must change if WorkOS becomes source
of truth.

## Supabase schema today

Current migration:

```text
supabase/migrations/20260623000000_hosted_v001_init.sql
```

Current access tables:

```text
users(supabase_user_id)
accounts
account_members
wiki_members
cli_tokens
wikis.account_id
```

Current RLS helpers:

```text
is_account_member(target_account_id)
is_wiki_member(target_wiki_id)
```

Pressure:

This makes Supabase the membership source of truth. That conflicts with the
WorkOS direction.

## Backend today

Current identity:

```text
src/almanac/services/hosted/identity.py
```

It resolves users through Supabase auth.

Current sessions:

```text
src/almanac/services/hosted/sessions.py
```

It ensures a default local account if none exists.

Current accounts:

```text
src/almanac/services/hosted/accounts.py
src/almanac/services/hosted/account_store.py
```

They create and read local account membership rows.

Current wikis:

```text
src/almanac/services/hosted/wikis.py
```

It creates a wiki under an `account_id` and writes `wiki_members`.

Pressure:

These services mix product behavior with local organization/membership
ownership. WorkOS should own those access primitives.

## API today

Current routes use bearer token extraction:

```text
apps/api/src/almanac_api/auth.py
apps/api/src/almanac_api/routes/hosted/*.py
```

Routes pass the bearer token into services. Services call the Supabase-backed
session/identity layer.

Pressure:

This is a good seam. Keep the route thinness, but replace what bearer tokens
mean and where session/member/role truth comes from.

## CLI today

Current auth state:

```text
src/almanac/hosted/auth_state.py
src/almanac/hosted/auth_store.py
```

It stores:

```text
api_url
token
wiki_id
```

Pressure:

It needs WorkOS-backed auth plus product context:

```text
api_url
token or provider credential
organization_slug
organization_id
organization_membership_id
wiki_slug
wiki_id
target = org/wiki
```

## Frontend today

Current hosted auth:

```text
frontend/src/features/hosted/auth/use-hosted-auth.ts
frontend/src/features/hosted/auth/supabase.ts
```

It uses Supabase auth client and Google OAuth.

Pressure:

This should become WorkOS/AuthKit. Organization switcher/user management should
come from WorkOS widgets if they satisfy the UI requirements.

## Product data to preserve

These tables are Almanac product truth and should remain ours:

```text
wikis
pages
topics
page_topics
source_import_batches
source_files
jobs
job_events
page_sources
```

But foreign keys and ownership columns should point at WorkOS organization ids,
not local account ids.
