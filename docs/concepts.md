# Concepts

CodeAlmanac has five core concepts.

## 1. Almanac Tree

Each repository owns one wiki tree at `almanac/`.

```text
your-repo/
|-- almanac/
|   |-- README.md
|   |-- topics.yaml
|   |-- architecture/
|   |   |-- README.md
|   |   `-- indexing.md
|   |-- decisions/
|   |   `-- local-first.md
|   `-- guides/
|       `-- setup.md
|-- src/
`-- ...
```

There are no alternate roots.

## 2. Pages

A page is a Markdown file under `almanac/`, except reserved root files such as
`topics.yaml` and local config files.

The page id is its path under `almanac/` without `.md`:

```text
almanac/README.md                         -> README
almanac/architecture/README.md            -> architecture
almanac/architecture/indexing.md          -> architecture/indexing
almanac/guides/setup.md                   -> guides/setup
```

`README.md` files are folder landing pages. Route collisions are invalid:

```text
almanac/architecture.md
almanac/architecture/README.md
```

Those two files both map to `architecture`, so validation rejects the tree.

## 3. Topics

Topics are categories for pages. They live in `almanac/topics.yaml`.

Topics form a DAG, not a folder tree. A page can have multiple topics, and a
topic can have multiple parents.

```bash
codealmanac topics
codealmanac topics show systems --descendants
codealmanac search --topic systems
```

## 4. Links And Sources

Authored page links use normal Markdown links.

```markdown
[Indexing](architecture/indexing.md)
[Setup guide](guides/setup.md)
```

Structured evidence lives in `sources:` frontmatter.

```yaml
---
title: Auth Flow
topics: [systems]
sources:
  - id: auth-session
    type: file
    path: src/auth/session.py
    note: Login checks session state here.
---
```

File sources power `--mentions`:

```bash
codealmanac search --mentions src/auth/session.py
codealmanac search --mentions src/auth/
```

## 5. Local Index And Commands

Markdown is the source of truth. SQLite is a derived local cache under
`~/.codealmanac/`.

Query commands refresh the index silently when pages change.
`codealmanac validate` checks the wiki tree, links, sources, runtime state,
and derived index. `codealmanac reindex` forces a full rebuild. Under the hood,
`codealmanac init` queues an internal build run to construct the initial wiki.

Command groups:

| Group | Commands | AI needed? |
|---|---|---|
| Read | `list`, `search`, `show`, `topics`, `health`, `validate`, `serve` | No |
| Organize | `tag`, `untag`, `topics create/rename/delete/link` | No |
| Lifecycle | `init`, `ingest`, `garden`, `sync`, `jobs` | `ingest`, `garden`, and write-capable `sync` |
| Admin | `setup`, `uninstall`, `doctor`, `update`, `automation`, `reindex` | No |

Scheduled automation is local scheduler state. It runs ordinary `codealmanac
sync`, `codealmanac garden`, or `codealmanac update --scheduled` commands; it
is not hosted sync. `codealmanac setup --yes` installs the default local
automation, and `codealmanac uninstall` removes CodeAlmanac-owned local
artifacts without a partial-uninstall mode.
