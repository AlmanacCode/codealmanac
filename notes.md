# CodeAlmanac Design Notes

## Current decisions

- The only wiki root is `almanac/`.
- Remove `docs/almanac/` and `.almanac/` as setup/configuration options.
- The CLI is `codealmanac`.
- Do not keep `almanac` or `alm` aliases for backward compatibility.
- The viewer uses the Alpine-inspired visual style.
- The viewer does not use the old raw tree UI.
- The viewer does not become the hosted product dashboard.
- Bring back the archived branded onboarding experience, modified for the new
  Python product decisions.

## Product History

`e773dc0b` is the fork point for the right local Python product.

Later `dev` and `main` moved ahead on the wrong hosted/cloud product direction.
Those branches can still be useful as reference, but they are not the product
direction.

Preserve `e773dc0b` as the branch base and build the right product forward from
there. The current branch for that work is `codex/right-product-from-e773dc0b`.
After the local-first product is rebuilt correctly, merge that direction back
into `dev` and `main`.

## Implementation Stance

Happy path is the best path.

Do not preserve backward compatibility for old CLI names, old wiki roots, old
page layouts, hosted-product assumptions, or retired syntaxes. Delete old paths
cleanly instead of carrying compatibility layers.

Do not over-defend the product with machinery. Add validation for real
invariants, but avoid defensive branches, fallback modes, migrations, aliases,
or recovery flows that exist only to support retired behavior.

Intelligence lives in prompts, not pipelines. When judgment is needed, improve
the prompt/manual/context given to the agent. Do not build orchestration that
tries to infer what the agent meant, split ownership of its edits, stage smart
commits, or simulate review/apply workflows.

Archive code is reference material. Borrow product feel, prompt wording, setup
rhythm, and proven behavior carefully. Do not copy archive architecture or
compatibility assumptions blindly.

## Legacy `.almanac/` Migration

The old `.almanac/` directory was outdated.

It contained useful project memory, but it represented the old product model:

- `.almanac/` as the wiki root,
- flat `.almanac/pages/`,
- double-bracket links,
- legacy file-list compatibility,
- old command names and old agent instructions.

Durable, still-true knowledge was migrated into the new `almanac/` tree after
the new page model landed.

The migration is a repo reset step, not a supported compatibility mode.
CodeAlmanac should not keep reading `.almanac/` as an alternate root after the
new `almanac/` tree is in place.

Migration shape:

```text
git history               old memory source
almanac/**/**/*.md        new browseable wiki source
~/.codealmanac/...        runtime state
```

The migrated wiki keeps facts that still match the local-first Python product.
It drops hosted/cloud assumptions, old storage rules, old link syntax, and
compatibility guidance.

## Onboarding experience

The Python setup flow recovers the archive onboarding feel.

Bring back:

- branded terminal banner,
- small product badge,
- step-by-step installer rhythm,
- clear status markers,
- polished next-steps box,
- interactive prompts when the terminal supports them,
- non-interactive `--yes` behavior for scripts.

Adapt for the new Python product:

- command is `codealmanac`,
- wiki root is only `almanac/`,
- no hosted path,
- no alternate roots,
- no compatibility aliases,
- auto-update automation is installed by default,
- interactive onboarding asks: "Do you want to keep CodeAlmanac up to date
  automatically?",
- non-interactive `--yes` chooses the happy-path default and enables
  auto-update,
- sync/Garden automation is installed by default; opt-out flags disable it,
- auto-commit is on by default; opt-out flags disable it,
- uninstall removes CodeAlmanac-owned binary/instructions/automation/global
  state but never deletes repo `almanac/`.
- uninstall has one meaning: uninstall everything CodeAlmanac owns. Do not add
  `--target`, `--keep-automation`, `--keep-instructions`, or other
  partial-uninstall flags.
- `codealmanac setup` is computer-level onboarding. It does not initialize,
  detect, register, or mutate a repo `almanac/` tree.
- `codealmanac init` is the public command for the first wiki build. Internally
  it starts a `build` operation. There are exactly three internal wiki
  operations: `build`, `ingest`, and `garden`. `sync` is transcript intake that
  creates `ingest` runs. `update` is product maintenance. `capture` is retired
  language.

The setup flow feels like the archive installer, not the current plain panel
summary.

Setup asks four questions, in this order:

1. agent instruction targets,
2. initialized repo wiki maintenance model,
3. automatic product updates,
4. agent change handling.

Every interactive choice uses left/right or equivalent directional selection
with a visual choice surface. Do not use plain `[Y/n]` as the primary
experience for multi-option product decisions. The screen shows how many
questions remain, such as `[2/4]`.

The maintenance question is about initialized repo wikis, not "keeping
CodeAlmanac running." The user-facing framing is: "How should CodeAlmanac keep
initialized repo wikis updated?" Automatic mode syncs quiet agent sessions into
the right repo's `almanac/` and gardens initialized wikis. Manual mode installs
no wiki maintenance schedules.

The final next step is only:

```text
Navigate to your repo of choice:

cd /path/to/your/repo
codealmanac init
```

## How `almanac/` Feels

`almanac/` is readable in a normal editor or GitHub file browser.
It feels like a clean documentation source tree, not hidden app state.

Example:

```text
almanac/
  README.md
  architecture/
    README.md
    cli/
      command-boundaries.md
      command-output.md
    indexing/
      README.md
      indexer.md
      sqlite/
        derived-index.md
        path-normalization.md
    viewer/
      README.md
      local-viewer.md
      navigation/
        sidebar.md
        page-routes.md
        backlinks-panel.md
  concepts/
    wiki-graph/
      backlinks.md
      topics.md
      links.md
    sources/
      file-references.md
      transcripts.md
      github-prs.md
  decisions/
    product/
      local-only.md
      only-almanac-root.md
    cli/
      cli-name-codealmanac.md
  guides/
    setup/
      install.md
      automation.md
    writing/
      write-a-good-page.md
      split-or-merge-pages.md
    operations/
      recover-history.md
  reference/
    cli/
      commands.md
      config.md
    page-format/
      frontmatter.md
      links.md
  topics.yaml
```

Nested folders are encouraged. A good `almanac/` feels designed, not
artificially flat.

Folders are allowed to carry meaning for browsing:

```text
almanac/architecture/indexing/path-normalization.md
almanac/architecture/viewer/navigation.md
almanac/guides/operations/recover-history.md
```

Folders are not the only meaning system. Topics, Markdown links, backlinks,
and sources still matter.

## Remove `pages/`

The current `almanac/pages/*.md` model makes the wiki feel like app storage.
The new model removes `pages/` and lets markdown files live directly in
meaningful folders under `almanac/`.

Folders are for browsing.
Pages are normal markdown files.

## Filenames

Filenames are human-readable and short.

Good:

```text
viewer.md
local-only.md
file-references.md
```

Bad:

```text
viewer-local-browser-for-almanac-8f3a2.md
decision-local-only-python-product-long-unique-id.md
```

The file path does not need weird uniqueness tricks.

The long filename problem comes from unclear model instructions, not an
identity requirement.

The manual and prompts explicitly tell the writer:

- prefer short filenames,
- use 2-5 words,
- do not include summaries in filenames,
- do not add IDs or hashes except for a real collision,
- use nested folders to disambiguate instead of long filenames.

Example:

```text
Good:
almanac/architecture/viewer/navigation.md

Bad:
almanac/pages/viewer-navigation-local-browser-sidebar-routes-unique-983af1.md
```

## Page identity

Rule:

- File path is for browsing.
- The path under `almanac/` is the canonical page identity.
- Authored page links use Mintlify-style extensionless paths.

Example:

```md
---
title: Viewer
summary: The local viewer renders the repo's almanac as a browsable wiki.
topics: [architecture]
sources:
  - id: viewer-assets
    type: file
    path: src/codealmanac/server/assets/viewer/
    note: Static viewer assets and client-side routes.
---

The viewer is the local browser for the repo's almanac.
```

Use `sources:` as the canonical evidence field.

File references are represented as `sources:` entries with `type: file`.
A file source powers `search --mentions`.

If the file is here:

```text
almanac/architecture/viewer/local-viewer.md
```

Then its canonical page id is:

```text
architecture/viewer/local-viewer
```

Preferred page links:

```md
[Viewer navigation](architecture/viewer/navigation)
[Local-only decision](decisions/local-only)
[File references](concepts/file-references)
```

The path starts at `almanac/` and omits `.md`.

Do not use double-bracket links for page links. Use Markdown links from the
`almanac/` tree in root pages and relative paths in nested pages.

## Inline link examples

Normal page-to-page links look like docs links:

```md
The [viewer sidebar](architecture/viewer/navigation/sidebar) is the primary
browsing surface.
```

Link to a decision:

```md
This follows the [local-only decision](decisions/product/local-only).
```

Link to a reference page:

```md
For frontmatter fields, see [page frontmatter](reference/page-format/frontmatter).
```

Use inline code for repo paths when the prose is just naming a file:

```md
The implementation lives in `src/codealmanac/server/assets/viewer/`.
```

Use `sources:` when the page's claims depend on that file:

```yaml
sources:
  - id: viewer-assets
    type: file
    path: src/codealmanac/server/assets/viewer/
    note: Static viewer implementation.
```

Markdown links are the default for human-readable pages.

## Viewer feel

The viewer shows the wiki as a browseable source tree:

```text
almanac
  architecture
    App Composition Root
    Indexer
    Viewer
  concepts
    Backlinks
    File References
    Topics
  decisions
    Local Only
    CLI Name: codealmanac
```

When viewing a page, the header shows its path:

```text
almanac / architecture / viewer.md

Viewer
Local browser for the repo's almanac.
```

The side panel shows wiki context:

```text
Backlinks
Related topics
Referenced files
```

## Path identity

Hidden global slugs make the wiki feel weird. If the file lives at
`almanac/architecture/viewer/navigation.md`, the page identity is
`architecture/viewer/navigation`.

The clean model is path-first:

```text
Path: almanac/architecture/viewer/navigation.md
Page id: architecture/viewer/navigation
```

Same filenames are allowed in different folders:

```text
almanac/architecture/viewer/navigation.md
almanac/guides/navigation.md
```

Preferred links copy Mintlify's convention:

```md
[Navigation](architecture/viewer/navigation)
```

Rules:

- start from the `almanac/` root,
- omit `.md`,
- use readable link text,
- prefer relative links from nested pages,
- do not invent hidden slugs for links.

This gives us consistency without forcing long filenames.

## Prompt/manual requirement

The prompt and manual explicitly tell the model:

- organize pages in nested folders,
- use short filenames,
- link to other pages with extensionless Markdown paths,
- prefer `[label](folder/page)` from root pages and relative links from nested pages,
- do not use double-bracket links,
- never create long filenames just to satisfy uniqueness.

Example:

```md
See [viewer navigation](architecture/viewer/navigation) for the local browser
route model.
```

Avoid opaque id-style targets such as `viewer-navigation-local-browser-route-model-8f3a2`.

## File refs vs page refs

Double-bracket links are retired.

Page links:

```md
[Sidebar navigation](architecture/viewer/navigation/sidebar)
```

Repo file references in prose:

```md
`src/codealmanac/server/assets/viewer/main.js`
```

Repo file references as evidence:

```yaml
sources:
  - id: viewer-main
    type: file
    path: src/codealmanac/server/assets/viewer/main.js
    note: Client-side viewer entrypoint.
```

## Parentheses for disambiguation

Parentheses are okay for human-facing titles:

```md
# Navigation (Viewer)
```

They are not the default filename strategy.

Prefer this:

```text
almanac/architecture/viewer/navigation.md
almanac/guides/navigation.md
```

Over this:

```text
almanac/architecture/navigation-viewer.md
almanac/guides/navigation-guide.md
```

Use parentheses or longer names only when two pages otherwise sit next to
each other in the same folder.

## No slugs

There is no required `slug:` field.

The canonical page id is the page path under `almanac/`, without `.md`.

Example:

```text
Path: almanac/architecture/viewer/navigation/sidebar.md
Page id: architecture/viewer/navigation/sidebar
```

The writer does not invent weird unique IDs for files.

Route rules:

```text
almanac/README.md                         -> README
almanac/architecture/README.md            -> architecture
almanac/architecture/viewer/sidebar.md    -> architecture/viewer/sidebar
```

Validation rejects route collisions:

```text
almanac/architecture.md
almanac/architecture/README.md
```

Both map to `architecture`.

## Agent reading and querying

Agents read pages by path-first page id, not by hidden slug.

Examples:

```bash
codealmanac show architecture/viewer/navigation/sidebar
codealmanac show decisions/product/local-only
```

Agents discover pages through search and source references:

```bash
codealmanac search "viewer navigation"
codealmanac search --mentions src/codealmanac/server/assets/viewer/
codealmanac topics show architecture --descendants
```

Read commands refresh the derived index automatically when needed.
The agent does not run a separate indexing command before querying.

## Validation

At `e773dc0b`, the code exposes `codealmanac health`, not a public
`codealmanac validate` command.

The new design adds a validation command for agents.

Command:

```bash
codealmanac validate
```

It checks:

- page paths are valid,
- links resolve,
- root-relative Markdown page links point to existing pages,
- `sources:` entries have required fields,
- file sources point to real repo paths in the current checkout,
- the derived DB/index agrees with the current markdown tree,
- no runtime files live under committed `almanac/`.

Lifecycle runs run validation automatically before finishing. Agents also
run it manually before handing work back.

## Auto-commit

Auto-commit exists and is on by default.

Default behavior:

- CodeAlmanac writes changes under `almanac/`,
- CodeAlmanac tells the lifecycle agent that committing wiki source changes is
  allowed,
- the lifecycle agent uses normal `git` commands when it chooses to commit,
- commit message uses a predictable shape like `almanac: <summary>`.

Opt-out behavior:

- user disables auto-commit in config or setup,
- CodeAlmanac tells the lifecycle agent not to commit,
- the lifecycle agent leaves wiki source changes in the working tree,
- the user reviews and commits manually.

Auto-commit is prompt policy, not Git orchestration.

CodeAlmanac does not stage files, split diffs, classify pre-existing wiki edits,
transport commits across branches, or run a smart committer. The model receives
the source-control rule in its prompt/manual context and owns the git action.

When auto-commit is enabled, the prompt allows committing wiki source files:

Commit:

```text
almanac/**/*.md
almanac/topics.yaml
almanac/config.toml
```

Never commit:

```text
almanac/index.db
almanac/jobs/
logs
runtime files
unrelated repo files
pre-existing user changes
```

Do not make auto-commit an interactive prompt. The CLI stays scriptable.

Do not implement auto-commit with an internal Git integration. If validation is
needed, validate the final wiki and runtime boundaries. Do not move judgment out
of the prompt.

Controls:

```bash
codealmanac setup --no-auto-commit
codealmanac config set auto_commit true
codealmanac config set auto_commit false
```

At `e773dc0b`, the code does not implement this feature.
It must be added.

## Runtime state location

The committed wiki stays clean and browseable.

Repo:

```text
repo/
  almanac/
    README.md
    architecture/
    concepts/
    decisions/
    guides/
    reference/
    topics.yaml
```

Derived runtime state lives under the user's home directory instead of
inside `almanac/`.

Home state:

```text
~/.codealmanac/
  registry.json
  repos/
    <repo-id>/
      index.db
      index.db-wal
      index.db-shm
      runs/
        run_123.json
        run_123.jsonl
        run_123.spec.json
```

SQLite will work fine there. The important requirements are:

- create the parent directory before opening the database,
- keep WAL files beside the database,
- use one per-repo database instead of one global shared database,
- keep the repo id stable enough to find the state again,
- tolerate missing runtime state by rebuilding the index.

## Registry and repo state

Keep one global registry:

```text
~/.codealmanac/registry.json
```

The registry answers:

- which repos CodeAlmanac knows about,
- where each repo lives,
- where its `almanac/` root is,
- what stable repo id maps to its runtime state.

Keep runtime state separate per repo:

```text
~/.codealmanac/repos/<repo-id>/
```

Do not put every wiki into one shared SQLite database. Per-repo SQLite keeps
locking, cleanup, corruption recovery, and debugging simpler.

Model:

```text
global registry
per-repo runtime directory
per-repo SQLite
clean committed almanac/ tree
```

## Run mutation policy

The run is generous when it is explicitly triggered.

Do not require `almanac/` to be clean before a run. If the user or automation
triggered the run, the system assumes the run is allowed to operate on
the current wiki state.

Rule:

- snapshot Git status before the run,
- allow existing `almanac/` changes,
- let the agent work with the current `almanac/` tree,
- after the run, compute what changed,
- make sure no non-Almanac files were changed,
- auto-commit only the final `almanac/` source state when auto-commit is on.

This means pre-existing wiki edits and agent edits are committed together.
That is acceptable when the run was intentionally triggered.

The safety boundary is:

```text
Agent can mutate almanac/.
Agent cannot mutate application source files.
```

Not:

```text
almanac/ must be perfectly clean before the run starts.
```

Stronger safety belongs in run metadata and commit summaries, not a hard
preflight block.

## AGENTS.md attribution

AGENTS.md tells agents to use Almanac as project memory, but not to make
every answer sound ceremonial.

Bad default:

```text
According to Almanac...
According to Almanac...
According to Almanac...
```

Rule:

- check relevant Almanac pages before touching related code,
- if an Almanac page materially shapes the answer, mention it naturally,
- cite the page path or title when explaining architecture, history, or a
  non-obvious project rule,
- do not cite Almanac for facts verified directly in code except when the page is
  part of the reasoning,
- if code and Almanac disagree, trust code and say the page needs an update.

Example:

```text
I checked `architecture/viewer/navigation`; it says the viewer is local-first,
so keep the folder browser as the primary navigation.
```

For PRs, reviews, and design discussions, agents name the Almanac pages
they relied on. For tiny fixes, no attribution is needed.
