# What Makes a Good Codebase Wiki

A codebase wiki is useful when a future agent or human can make a safer code
change faster after reading it. It should explain what the code cannot say on
its own: rationale, constraints, cross-file flows, operational assumptions,
failure modes, migrations, and external dependencies.

## Sources

Sources make a page trustworthy. A substantial page should show where its
knowledge came from, and each source should say what it supports.

Use `sources:` for evidence:

```yaml
sources:
  - id: capture-command
    type: file
    path: src/commands/capture.ts
    note: Starts capture and records run metadata.
  - id: provider-docs
    type: web
    url: https://example.com/provider/docs
    retrieved_at: 2026-05-28
    note: Documents provider behavior used by this repo.
```

Use `type: file` for repo files, tests, migrations, prompts, and config. Use
other source types for web docs, commits, PRs, conversations, wiki pages, or
manual notes. Cite non-obvious claims with `[@source-id]` when the claim needs
visible evidence.

Code is current truth for present-tense code claims. Conversations, old PRs,
old commits, and incident notes are historical evidence unless the claim is
verified against current code, tests, config, or current external docs.

Package updates should not rewrite wiki files. Mechanical migration of old
source frontmatter should happen only through an explicit maintenance action
such as `almanac health --fix`.

## Links

Links make a page usable. Link concepts, not words. A good page links upward to
the larger subject, sideways to adjacent systems, and downward to workflows,
constraints, references, and source files.

Use readable link text in prose:

```markdown
Capture updates pages through [[absorb-operation|the Absorb operation]].
```

Slug-only links are fine when the slug is already readable in context:

```markdown
See [[capture-flow]].
```

## Names

Page names should be clear to a reader who has not seen the implementation.
Prefer `Claude Agent SDK`, `Capture Flow`, and `Where Almanac Stores Data` over
genre labels such as `runtime-view` or `dependency-claude-agent-sdk`.

## Subject Neighborhoods

A page is the unit of reading. A neighborhood is the unit of understanding. A
large subject usually needs an anchor page plus nearby pages for behavior,
structure, contracts, rationale, constraints, workflows, and sources.

Do not force every subject into every page shape. Small entities may need one
page. Major subsystems and dependencies should grow into a linked neighborhood
when one page becomes too dense.
