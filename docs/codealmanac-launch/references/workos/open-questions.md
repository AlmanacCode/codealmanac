# Open questions

These need current-doc inspection or implementation spikes.

## CLI auth implementation detail

Can WorkOS CLI Auth fully replace Almanac's custom CLI token flow?

If yes, prefer it.

If no, use WorkOS to authenticate and let Almanac mint a narrow backend token
with explicit organization/wiki claims.

## Agent auth implementation detail

Can WorkOS agent registration directly model our CLI/agent use case?

Need answer for:

```text
local coding agent
Modal worker agent
future MCP client
headless CI-like agent
```

## FGA latency implementation detail

Should Almanac call WorkOS FGA on every request, cache decisions briefly, or
mirror a read model in Postgres?

Recommendation:

Start direct and simple. Cache only if latency or cost forces it.

## Widgets implementation detail

Can WorkOS widgets fully cover:

```text
organization switcher
user management
API keys
user sessions
user security
```

If yes, remove our duplicate UI ambitions.

## Billing

Should Autumn customer ids attach to WorkOS organization ids directly?

Recommendation:

Yes. Billing is organization-level.
