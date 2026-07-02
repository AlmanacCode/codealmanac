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
| Lifecycle | `init`, `build`, `ingest`, `garden`, `sync`, `jobs` | `ingest`, `garden`, and write-capable `sync` |
| Admin | `setup`, `login`, `whoami`, `logout`, `capture`, `uninstall`, `doctor`, `update`, `automation`, `reindex` | No |

Scheduled automation is local scheduler state. It runs ordinary `codealmanac
sync` or `codealmanac garden` commands; it is not hosted sync.
`codealmanac setup --install-automation` can install those scheduler entries,
and `codealmanac uninstall --keep-automation` leaves them in place.
