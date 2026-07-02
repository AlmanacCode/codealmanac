# Auth and CLI

Status: first implementation hypothesis

## Decision direction

Replace custom browser-token copying with WorkOS-supported CLI/device auth if
the API supports our installed CLI use case.

## CLI contexts

The Almanac CLI still keeps product context:

```text
selected organization slug
selected wiki slug
selected wiki id
target = org/wiki
```

But auth should come from WorkOS:

```text
human login -> WorkOS AuthKit / CLI Auth
agent login -> WorkOS agent registration or API key
organization membership -> WorkOS
```

## Commands

```bash
almanac login
almanac whoami
almanac logout
```

`whoami` should print WorkOS-backed identity and Almanac target:

```text
user: rohan@example.com
org:  reverie
wiki: reverie/legal
auth: WorkOS CLI Auth
```

## Token storage

Do not store copied browser refresh tokens.

Acceptable:

```text
WorkOS CLI/device auth token
WorkOS-backed agent credential
Almanac narrow token minted after WorkOS auth, if direct WorkOS token use is not viable
```

If Almanac mints a narrow token, it should carry only what the backend needs:

```text
subject
actor type
organization ids
expiry
scopes or token id
```

It should not become a second identity system.
