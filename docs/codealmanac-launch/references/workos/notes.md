# Notes

## Current hypothesis

Move completely to WorkOS for hosted access. Treat existing Supabase account and
membership tables as replaceable.

## Why it seems plausible

WorkOS documentation covers AuthKit, organizations, organization memberships,
invitations, widgets, RBAC/FGA, API keys, CLI auth, and agent registration. That
is the exact area Almanac should avoid owning.

## What changed

The previous CLI design treated WorkOS as a likely provider. This pass raises
the bar: WorkOS should become the source of truth unless a concrete API gap
appears.

## Next research move

Read the generated source index, then inspect these docs first:

```text
AuthKit CLI auth
AuthKit agent registration
Agents validate credential
Organizations
Organization memberships
Invitations
Widgets: organization switcher and user management
FGA and RBAC
API keys
```
