# API, CLI, and frontend contract

Status: proposed contract after WorkOS migration

## API

Auth:

```text
Authorization: Bearer <WorkOS-backed credential or narrow Almanac token>
```

Context endpoints:

```text
GET /api/me
GET /api/orgs
GET /api/orgs/{org}
GET /api/orgs/{org}/wikis
POST /api/orgs/{org}/wikis
GET /api/orgs/{org}/wikis/{wiki}
```

Product endpoints can stay wiki-id based internally:

```text
GET /api/wikis/{wiki_id}/pages
GET /api/wikis/{wiki_id}/sources
GET /api/wikis/{wiki_id}/jobs
```

The API resolver returns:

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

## CLI

Login:

```bash
almanac login
```

Uses WorkOS CLI/device auth if viable.

Context:

```bash
almanac switch reverie
almanac use reverie/legal
almanac whoami
```

Stored state:

```text
api_url
credential reference
organization_slug
organization_id
organization_membership_id
wiki_slug
wiki_id
target
```

## Frontend

Use WorkOS/AuthKit for:

```text
login
session
organization switching
user management
user security
API keys where useful
```

Use Almanac UI for:

```text
wiki picker
wiki pages
source library
jobs
garden/upload actions
```

## Errors

No auth:

```text
Not logged in.
Run: almanac login
```

No organization:

```text
No organization selected.
Run: almanac switch <org>
```

No wiki:

```text
No wiki selected.
Run: almanac use <org>/<wiki>
```

No access:

```text
You do not have access to reverie/legal.
Run: almanac wikis
```
