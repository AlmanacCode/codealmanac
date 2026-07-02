# Official evidence notes

Status: evidence summary from official WorkOS docs

This file records the WorkOS facts that materially change Almanac architecture.
It intentionally summarizes rather than vendoring the full documentation.

## Source map

The generated `source-index.md` comes from:

```text
https://workos.com/docs/llms.txt
```

The current source map found:

```text
610 official documentation URLs
133 heading snapshots
7 heading fetch failures from WorkOS llms.txt SDK markdown links
```

## CLI auth

Official docs:

```text
https://workos.com/docs/reference/authkit/cli-auth.md
```

Relevant facts:

- WorkOS CLI Auth implements the OAuth 2.0 Device Authorization Flow.
- The flow has a device authorization endpoint and a device-code exchange.
- The device-code exchange returns access and refresh tokens after user
  approval.
- Polling can return pending/denied/expired/invalid-style states.

Almanac implication:

`almanac login` should use WorkOS CLI Auth or a WorkOS-backed equivalent. It
should not copy a browser refresh token.

## Agent auth

Official docs:

```text
https://workos.com/docs/authkit/agent-auth.md
https://workos.com/docs/reference/authkit/agent-registration.md
https://workos.com/docs/reference/agents/validate-credential.md
```

Relevant facts:

- WorkOS has Agent Registration for programmatic clients.
- Agents can register with identity types including anonymous, service auth, and
  refresh.
- Service auth requires a claim ceremony.
- Anonymous registration can have limited pre-claim permissions.
- Agent access tokens can include organization id and an `act` delegation claim
  after a user binds the agent.
- API keys need server-side validation through the validate credential endpoint.

Almanac implication:

Use WorkOS Agent Registration for coding agents, Modal-like agents, and future
MCP clients if the implementation fits. Do not invent an Almanac-only agent
credential model first.

## Widgets

Official docs:

```text
https://workos.com/docs/widgets/organization-switcher.md
https://workos.com/docs/widgets/user-management.md
https://workos.com/docs/widgets/api-keys.md
https://workos.com/docs/widgets/user-sessions.md
https://workos.com/docs/widgets/user-security.md
```

Relevant facts:

- Organization Switcher lets users switch among organizations they can access.
- If an organization requires SSO or MFA, switching can force reauthorization.
- User Management is a WorkOS widget.
- Widget docs distinguish widget tokens from access tokens.

Almanac implication:

Use WorkOS widgets for organization switching, user management, API keys,
sessions, and user security where possible. Almanac UI should own wiki browsing,
source library, and jobs.

## FGA and AuthKit

Official docs:

```text
https://workos.com/docs/fga/authkit-integration.md
https://workos.com/docs/fga/access-checks.md
https://workos.com/docs/fga/high-cardinality-entities.md
https://workos.com/docs/fga/model-your-app-api-endpoints.md
```

Relevant facts:

- AuthKit sessions can carry organization-scoped role information.
- Resource-scoped roles are not placed in the JWT because they can be too large
  and need current checks.
- Resource-level permissions use the Authorization API.
- FGA access checks require organization membership id rather than raw user id
  when integrated with AuthKit.
- WorkOS recommends checking JWT claims first for org-wide permissions and using
  FGA API checks for resource-specific permissions.
- High-cardinality entities can stay in the application and be authorized
  through the nearest FGA-managed parent.

Almanac implication:

Use WorkOS organization membership id as the actor for resource-level checks.
Make organization and wiki FGA-managed resources first. Keep page/source/job
rows local unless we need individual sharing.
