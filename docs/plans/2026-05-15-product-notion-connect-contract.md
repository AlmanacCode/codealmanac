# Product Notion Connect Contract

## Goal

`almanac connect notion` should become a one-command product flow. For the self-hosted V1 in this branch, Almanac uses the local Composio credentials configured in `.env` / shell env and keeps that setup path explicit. A future hosted connector service can hide Composio API keys and auth config IDs without changing the ingest contract.

The command should connect Notion to Almanac, verify that Almanac can read shared Notion content, store a local connection reference, and point the user to `almanac ingest notion`.

## User Experience

Primary flow:

```bash
almanac connect notion
```

Expected output:

```text
Opening Notion authorization in your browser...
Waiting for approval...

Notion connected.
Verified access to 10 pages/databases.

Next:
  almanac ingest notion
```

If Notion is already connected:

```text
Notion is already connected.
Verified access to 10 pages/databases.

Next:
  almanac ingest notion
```

If the connection succeeds but no pages are shared:

```text
Notion connected, but Almanac cannot see any pages yet.
Share pages with the Almanac connection in Notion, then run:
  almanac connect notion --check
```

If browser opening fails:

```text
Open this URL to authorize Notion:
  https://...
```

## Product Principle

Composio is the self-hosted V1 auth provider. The local-only V1 may expose these setup env vars because the user is operating their own Composio project:

- `COMPOSIO_API_KEY`
- `COMPOSIO_NOTION_AUTH_CONFIG_ID`
- optional `COMPOSIO_USER_ID`

The future hosted product flow should make Composio an implementation detail and should not expose:

- Composio API keys
- Composio auth config IDs
- Composio connected account IDs
- Composio orgs/projects
- Composio tool names such as `NOTION_FETCH_DATA`
- Notion API token handling

Debug output may expose provider details only under `--verbose` or `--json` once a hosted service owns provider credentials.

## Command Surface

Required for self-hosted V1:

```bash
almanac connect notion
almanac connectors status
almanac disconnect notion
```

Optional developer fallback:

```bash
almanac connect notion --from-composio-cli
```

`--from-composio-cli` may reuse an already logged-in local Composio CLI. It is a development escape hatch, not the default product path.

## Under The Hood

The self-hosted V1 flow uses local Composio credentials:

```text
CLI
  -> Composio link session
  -> Notion OAuth
```

The CLI stores the Composio connected-account reference locally and uses the local `COMPOSIO_API_KEY` for status checks and Notion proxy reads.

The future hosted flow uses an Almanac-owned connector service:

```text
CLI
  -> Almanac connector service
  -> Composio
  -> Notion OAuth
```

In the hosted flow, the CLI does not own Composio credentials. The connector service owns provider secrets and returns opaque Almanac connection references.

## Backend API Contract

The CLI talks to an Almanac connector API. Endpoint names are provisional, but the data contract should hold.

### Create Connect Session

Request:

```http
POST /connectors/notion/sessions
```

Body:

```json
{
  "client": "codealmanac-cli",
  "repoName": "codealmanac"
}
```

Response:

```json
{
  "sessionId": "connsess_123",
  "connectUrl": "https://...",
  "expiresAt": "2026-05-15T20:00:00.000Z"
}
```

The backend creates a Composio link session and returns the browser URL. The CLI opens `connectUrl`.

### Poll Connect Session

Request:

```http
GET /connectors/sessions/connsess_123
```

Pending:

```json
{
  "status": "pending"
}
```

Connected:

```json
{
  "status": "connected",
  "connection": {
    "id": "conn_123",
    "provider": "composio",
    "toolkit": "notion"
  }
}
```

Failed:

```json
{
  "status": "failed",
  "message": "Notion authorization was denied."
}
```

Expired:

```json
{
  "status": "expired",
  "message": "The authorization link expired."
}
```

### Verify Connection

Request:

```http
POST /connectors/notion/connections/conn_123/verify
```

Response with accessible content:

```json
{
  "status": "active",
  "accessible": {
    "pages": 9,
    "databases": 1,
    "hasMore": true
  }
}
```

Response with no shared pages:

```json
{
  "status": "active",
  "accessible": {
    "pages": 0,
    "databases": 0,
    "hasMore": false
  },
  "needsAction": {
    "message": "No Notion pages are shared with Almanac yet.",
    "fix": "Share pages with the Almanac connection in Notion, then run: almanac connect notion --check"
  }
}
```

### Disconnect

Request:

```http
DELETE /connectors/notion/connections/conn_123
```

The backend revokes/deletes the upstream Composio connection where possible. The CLI then removes the local connection record.

## Local State

The CLI stores only an opaque local reference:

```text
~/.almanac/connectors.json
```

Shape:

```json
{
  "version": 1,
  "connectors": {
    "notion": {
      "provider": "almanac-cloud",
      "connectionId": "conn_123",
      "status": "active",
      "createdAt": "2026-05-15T19:00:00.000Z",
      "verifiedAt": "2026-05-15T19:01:00.000Z",
      "accessible": {
        "pages": 9,
        "databases": 1,
        "hasMore": true
      }
    }
  }
}
```

The local file must not store:

- Notion access tokens
- Composio API keys
- Composio auth config IDs
- OAuth link tokens

The existing `cli:notion` Composio CLI record remains valid only as a development fallback mode.

## CLI Behavior

`almanac connect notion`:

1. Read `~/.almanac/connectors.json`.
2. If a Notion connection exists, verify it unless `--skip-check` is introduced later.
3. If no valid connection exists, create a connect session through the Almanac connector service.
4. Open the returned browser URL.
5. Poll until connected, failed, expired, or timed out.
6. Verify read access.
7. Store the local connection reference.
8. Print the next command.

`almanac connect notion --check`:

1. Require an existing local Notion connection.
2. Verify read access through the connector service.
3. Update local `verifiedAt`, `status`, and accessible counts.
4. Print current status and guidance.

`almanac connectors status`:

1. Read local connector records.
2. Show product-level state by default.
3. Use `--json` for structured output.

`almanac disconnect notion`:

1. Read local connector record.
2. Ask the connector service to revoke the connection.
3. Remove local state even if remote revoke fails with a recoverable already-gone error.

## Error Handling

Missing backend auth or unavailable service:

```text
Could not reach Almanac connector service.
Try again, or use:
  almanac connect notion --from-composio-cli
```

Authorization timeout:

```text
Notion authorization timed out.
Run again:
  almanac connect notion
```

Authorization denied:

```text
Notion authorization was denied.
Run again when ready:
  almanac connect notion
```

No pages shared:

```text
Notion connected, but Almanac cannot see any pages yet.
Share pages with the Almanac connection in Notion, then run:
  almanac connect notion --check
```

## Verification

### Unit Tests

- Existing connection record is reused and verified.
- Missing connection creates a connect session.
- Browser open failure prints the URL.
- Pending session polling continues until connected.
- Failed, expired, and timed-out sessions produce actionable errors.
- Verification with zero accessible pages returns needs-action guidance.
- Local state stores only opaque Almanac connection references.
- Local state never stores provider secrets or link tokens.
- `--from-composio-cli` remains available as a fallback and records `mode: "cli"`.

### Integration Tests With Mock Backend

- `almanac connect notion` creates a session, opens URL through an injected opener, polls to connected, verifies access, and writes `~/.almanac/connectors.json`.
- `almanac connect notion --check` verifies an existing record and updates accessible counts.
- `almanac connectors status --json` returns the stored Notion state.
- `almanac disconnect notion` calls backend revoke and removes the local record.

### Manual Acceptance Test

1. Start with no local Notion connector record.
2. Run:

   ```bash
   almanac connect notion
   ```

3. Browser opens to Notion authorization.
4. User approves and shares/selects pages.
5. CLI prints a connected message with accessible page/database counts.
6. Confirm local state:

   ```bash
   almanac connectors status
   ```

7. Run:

   ```bash
   almanac ingest notion
   ```

8. Confirm that ingest can fetch source documents through the stored Almanac connection reference.

## Non-Goals

This contract does not define the full Notion ingest algorithm. It only defines product-grade connection UX and local connection state.

This contract does not require removing the Composio CLI fallback. It demotes that path to development/debugging.
