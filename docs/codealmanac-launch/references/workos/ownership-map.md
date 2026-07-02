# Ownership map

## Product nouns

```text
WorkOS organization -> Almanac organization
Almanac wiki        -> product resource owned by one WorkOS organization
Almanac source      -> product resource under one wiki
Almanac job         -> product resource under one wiki
```

## Who owns what

| Area | Owner | Almanac stores |
| --- | --- | --- |
| User identity | WorkOS | WorkOS user id, display fields if needed |
| Sessions | WorkOS/AuthKit | no raw session source of truth |
| Organizations | WorkOS | WorkOS organization id/slug mirror if needed |
| Memberships | WorkOS | membership id mirror only if needed |
| Invitations | WorkOS | none unless product audit needs a copy |
| Roles | WorkOS | role names only for display/cache if needed |
| FGA checks | WorkOS | resource ids and relations needed for checks |
| Billing | Autumn | billing customer id, entitlement result cache if needed |
| Wikis | Almanac | wiki rows keyed by WorkOS organization id |
| Sources | Almanac | metadata and storage keys |
| Jobs | Almanac | job ledger and events |

## DB naming direction

Prefer future names:

```text
organizations
organization_memberships
wikis.organization_id
```

But only if those rows are mirrors of WorkOS. If WorkOS can answer the question
directly at request time, do not store the mirror.
