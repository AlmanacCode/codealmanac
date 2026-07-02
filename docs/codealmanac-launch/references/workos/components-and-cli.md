# WorkOS components and CLI

Status: researched and locally prepared

## Enterprise answer

Yes. WorkOS is built for the enterprise layer we do not want to own:

```text
SSO
SCIM / Directory Sync
organizations
memberships
invitations
roles and permissions
FGA
audit logs
admin portal flows
customer API keys
agent authorization
```

That matches Almanac's boundary: WorkOS owns identity and access. Almanac owns
wikis, sources, pages, jobs, and product behavior.

## Components to use

Use WorkOS/AuthKit for the auth shell:

```text
hosted sign-in
hosted sign-up
AuthKitProvider
withAuth / useAuth
route middleware / proxy
logout
```

Use WorkOS Widgets for account and enterprise workflows:

```text
Organization Switcher
User Management
User Profile
User Security
API Keys
Directory Sync
Audit Log Streaming
SSO Connection
Domain Verification
Admin Portal
```

Do not build Almanac versions of these unless a WorkOS limitation forces it.

## Almanac UI remains

Almanac still builds the product surfaces:

```text
wiki picker
wiki pages
source library
jobs
upload
garden
search
show
```

The top-left account/org control should come from WorkOS or follow WorkOS
organization semantics. Wiki selection is Almanac product UI.

## CLI state

The official WorkOS CLI exists as the `workos` npm package.

Verified locally:

```text
package: workos
version: 0.17.1
binary: workos
current shell node: v21.7.3
required by CLI dependencies: Node >= 22.11 / >= 22.12
status: npx workos works with engine warnings
auth status: authenticated as reveriedev.one@gmail.com
active environment: staging / sandbox
```

Doppler state:

```text
WORKOS_API_KEY set in dev, stg, and prd
WORKOS_CLIENT_ID set in dev, stg, and prd
WORKOS_COOKIE_PASSWORD set in dev, stg, and prd
```

Installed WorkOS Codex skills:

```text
~/.codex/skills/workos
~/.codex/skills/workos-widgets
```

Those skills require future WorkOS implementation work to read the relevant
WorkOS references first and to use `WORKOS_MODE=agent` for CLI calls.

## Useful commands

Use these for inspection:

```bash
WORKOS_MODE=agent npx -y workos --help --json
WORKOS_MODE=agent npx -y workos doctor --json --skip-ai
WORKOS_MODE=agent npx -y workos auth status --json
WORKOS_MODE=agent npx -y workos skills list --json
```

Use this only in a controlled auth setup slice:

```bash
WORKOS_MODE=agent npx -y workos auth login
```

Use this only in a controlled code-changing slice:

```bash
WORKOS_MODE=agent npx -y workos install
```

`workos install` can modify app code, configure environment values, and wire
AuthKit. It should not run during research.

## Setup consequence

Before depending on the CLI in automation, give the repo a project-managed
Node runtime at or above Node 22.12. The current shell can run `npx workos`,
but the engine warning is avoidable friction.

Once authenticated, prefer WorkOS-managed setup and seed flows over hand-built
identity tables:

```text
workos seed
workos setup-org
workos onboard-user
workos debug-sso
workos debug-sync
```

## User-facing Almanac CLI requirement

Everything required to operate Almanac must be possible through the Almanac CLI.

This is not acceptable:

```text
use a website feature that the CLI cannot do
ask an agent to upload through a hidden internal tool
make users understand WorkOS, Autumn, Doppler, Render, Vercel, Modal, or Supabase
```

This is the target:

```bash
almanac login
almanac orgs
almanac use reverie/legal
almanac create "Company Handbook"
almanac upload docs/
almanac search "customer onboarding"
almanac show onboarding
almanac sources tree
almanac jobs
almanac garden --guidance "refresh stale pages"
almanac billing
```

The CLI is for end users and agents using Almanac. It mirrors website product
actions.

Provider setup is not part of this user-facing CLI. WorkOS, Autumn, Doppler,
Render, Vercel, Modal, and Supabase setup belongs in internal scripts or
operator docs, not in `almanac` commands unless end users truly need it.

## Product rule

If WorkOS has a primitive, use the WorkOS primitive.

If Almanac needs a local row, name it as a product row or mirror:

```text
wikis
sources
jobs
pages
workos_organization_mirrors
```

Do not recreate users, organizations, memberships, invitations, or API-key
management as Almanac-owned systems.
