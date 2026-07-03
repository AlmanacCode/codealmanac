# Concepts

CodeAlmanac has five core concepts.

## 1. Wiki Root

Each repository owns its wiki files. The default root is `almanac/`.

```text
your-repo/
|-- almanac/
|   |-- README.md
|   |-- topics.yaml
|   |-- pages/
|   |-- manual/
|-- src/
`-- ...
```

`docs/almanac/`, `.almanac/`, or another safe repo-relative directory can be
used with `codealmanac init --root <path>`.

For auto-detection, a folder counts as a CodeAlmanac wiki only when it has both
`topics.yaml` and `pages/`. `README.md` alone is guidance, not a marker.

## 2. Pages

A page is a markdown file under `<almanac-root>/pages/`. It documents one
durable subject: a decision, subsystem, external service, workflow, incident,
invariant, or gotcha.

```markdown
---
title: Auth Flow
topics: [systems]
files:
  - src/auth/
---

# Auth Flow

Login checks [[src/auth/session.py]] and links to [[session-store]].
```

The filename is the slug: `auth-flow.md` becomes `auth-flow`.

## 3. Topics

Topics are categories for pages. They live in `<almanac-root>/topics.yaml`.

Topics form a DAG, not a folder tree. A page can have multiple topics, and a
topic can have multiple parents.

```bash
codealmanac topics
codealmanac topics show systems --descendants
codealmanac search --topic systems
```

## 4. Links And File References

One syntax handles page links, file references, folder references, and cross-wiki
references:

```markdown
[[auth-flow]]              # page link
[[src/auth/session.py]]    # file reference
[[src/auth/]]              # folder reference
[[other-wiki:auth-flow]]   # cross-wiki reference
```

File references power `--mentions`:

```bash
codealmanac search --mentions src/auth/session.py
codealmanac search --mentions src/auth/
```

## 5. Local Index And Commands

Markdown is the source of truth. SQLite is a derived local cache at:

```text
<almanac-root>/index.db
```

Query commands refresh the index silently when pages change. `codealmanac
reindex` forces a full rebuild.

Command groups:

| Group | Commands | AI needed? |
|---|---|---|
| Read | `list`, `search`, `show`, `topics`, `health`, `serve` | No |
| Organize | `tag`, `untag`, `topics create/rename/delete/link` | No |
| Lifecycle | `init`, `sync`, `local update`, `jobs`, `local jobs` | `init`, `sync`, and `local update` |
| Cloud | `setup`, `login`, `whoami`, `logout`, `capture`, `repo`, `runs`, `open` | No |
| Admin | `local setup`, `local triggers`, `automation`, `uninstall`, `doctor`, `update`, `reindex` | No |

Scheduled automation is local scheduler state. It runs ordinary `codealmanac
sync` jobs; it is not hosted sync. Root `codealmanac setup` is cloud setup and
agent instructions only. Local schedules stay behind explicit local or
automation commands. `codealmanac uninstall` removes setup-owned instruction
files only; use `codealmanac automation uninstall` to remove scheduler entries.
