# WorkOS Research Folder

Status: copied from `../almanac/docs/workos/` on 2026-07-02.

This is supporting research for the CodeAlmanac launch. The launch-specific
contract lives in `docs/codealmanac-launch/auth-api-contract.md`.

This folder prepares the hosted Almanac move to WorkOS-owned identity,
organizations, memberships, invitations, roles, RBAC/FGA, enterprise auth, and
agent authorization.

We do not vendor full WorkOS documentation into this repo. The repo stores:

- source indexes
- official URL maps
- heading snapshots where useful
- Almanac-specific implementation notes
- migration decisions and risks

Refresh the local source map:

```bash
python docs/codealmanac-launch/references/workos/scripts/refresh_workos_sources.py \
  --output docs/codealmanac-launch/references/workos \
  --fetch-headings
```

The script writes generated caches under the selected `research-cache/`.

Read in this order:

```text
source-index.md
official-evidence.md
final-recommendation.md
components-and-cli.md
workos-decision.md
ownership-map.md
auth-and-cli.md
agent-auth.md
fga-model.md
current-state-audit.md
target-architecture.md
almanac-migration.md
api-cli-frontend-contract.md
migration-plan.md
open-questions.md
```
