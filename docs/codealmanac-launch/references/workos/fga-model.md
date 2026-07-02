# FGA model

Status: first pass

Almanac should model authorization around product resources, not route names.

## Resource hierarchy

```text
organization: reverie
  wiki: reverie/legal
    page: safe-financing
    source: src_123
    job: job_456
```

Relevant WorkOS docs in `source-index.md`:

```text
FGA Quick Start
FGA AuthKit Integration
FGA Resource Types
FGA Resources
FGA Access Checks
FGA Resource Discovery
FGA High-Cardinality Entities
FGA Protecting API Endpoints
FGA Multi-level Inheritance
FGA Role Assignments
```

## Core permissions

```text
read_wiki
search_wiki
upload_source
download_source
run_ingest
run_garden
read_jobs
manage_wiki
manage_members
manage_billing
```

## Role sketch

```text
owner
admin
editor
reader
agent
```

Keep role semantics in WorkOS if possible. Almanac should ask whether the actor
can perform an action, not interpret long custom role rules in product code.

## Request flow

```text
request token
  -> WorkOS validates identity/session/agent
  -> Almanac resolves org/wiki
  -> WorkOS FGA checks action on resource
  -> Almanac service executes product behavior
```

## High-cardinality rule

Do not blindly create a WorkOS FGA resource for every page, source, and job if
WorkOS guidance suggests keeping high-cardinality entities in the application.

Likely split:

```text
organization -> WorkOS resource
wiki         -> WorkOS resource
page/source/job rows -> Almanac DB, protected through wiki-level checks first
exceptional shareable page/source -> WorkOS resource only if needed
```

This keeps authorization clear without forcing every content row through FGA.

## Code smell to avoid

Avoid scattering this through routes:

```text
if user.role == "owner" or user.role == "admin"
```

Prefer one authorization service:

```text
access.require(actor, "upload_source", wiki)
```
