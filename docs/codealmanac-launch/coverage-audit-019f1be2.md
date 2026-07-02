# Coverage Audit: 019f1be2

Status: active.
Transcript:
`/Users/rohan/.codex/sessions/2026/06/30/rollout-2026-06-30T21-14-17-019f1be2-83a2-7c03-bf18-f5adc681857d.jsonl`

This audit compares the decision-heavy parts of the chat against
`docs/codealmanac-launch/`.

## Result

The main decisions are now captured. Three gaps were found and fixed during this
audit:

- Exact public CLI contract was not in the launch folder.
- Frontend onboarding/dashboard responsibilities were only in support notes.
- Two-repo organization and dependency direction were not explicit enough.

The added files are:

```text
docs/codealmanac-launch/cli-contract.md
docs/codealmanac-launch/frontend-surface-contract.md
docs/codealmanac-launch/repo-organization.md
```

## Decision Coverage

| Discussion decision | Captured in |
| --- | --- |
| Launch is not an MVP/V1 shortcut plan | `overnight-run-contract.md`, launch plan |
| Rename `usealmanac` to `codealmanac-hosted` | `deployment-rename-runbook.md`, `ownership-map.md` |
| Deploy renamed cloud product through real providers | `deployment-rename-runbook.md`, `overnight-run-contract.md` |
| Infrastructure/deployment work happens first | `overnight-run-contract.md`, `worklog.md` |
| Cloud is default product experience | `decisions.md`, `cli-contract.md` |
| Local is explicit under `local` | `decisions.md`, `cli-contract.md` |
| One CLI, not separate `codealmanac-local` binary | `cli-contract.md` |
| `setup` is cloud setup, not repo-specific | `cli-contract.md`, `frontend-surface-contract.md` |
| `repo setup` opens repo-scoped cloud setup | `cli-contract.md`, `frontend-surface-contract.md` |
| Browser owns onboarding, policy, billing, consent | `frontend-surface-contract.md` |
| CLI owns local files, provider probing, hooks | `cli-contract.md`, `frontend-surface-contract.md` |
| Capture is explicit and not silently installed | `decisions.md`, `cli-contract.md` |
| Use `capture`, not `agents` | `decisions.md`, `cli-contract.md` |
| Avoid `repo`/`repos` split | `decisions.md`, `cli-contract.md` |
| Bare `codealmanac` opens cloud wiki route | `decisions.md`, `cli-contract.md`, `frontend-surface-contract.md` |
| Hide public `ingest`/`garden` | `decisions.md`, `cli-contract.md` |
| Public CLI is not worker API | `decisions.md`, `repo-organization.md` |
| Hosted worker consumes `codealmanac` | `ownership-map.md`, `repo-organization.md` |
| Local/cloud share engine request/result contract | `schema-contract.md`, `repo-organization.md` |
| Query DB and control DB are separate | `schema-contract.md` |
| Local control DB lives in user home | `schema-contract.md` |
| Local runs move from repo `.almanac/jobs` toward user-home run artifacts | `schema-contract.md` |
| Cloud stores run rows/events and bulky artifacts by reference | `schema-contract.md` |
| Cross-wiki links are sunset | `decisions.md`, `schema-contract.md` |
| Provider CLIs/APIs should be checked and used | `deployment-rename-runbook.md`, `overnight-run-contract.md`, `worklog.md` |
| Supabase migrations may be rewritten because there are no users | `decisions.md`, `deployment-rename-runbook.md` |

## Still Open

These were intentionally left as open product/implementation choices:

- Default cloud delivery mode: PR or commit.
- Default local delivery mode: working tree or commit.
- Exact stable cloud wiki resolver route.
- Exact production dependency pin from `codealmanac-hosted` to `codealmanac`.
- Exact Python auto-update library.

These are tracked in `open-questions.md`.
