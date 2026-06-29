# Slice 6: Topic Rename And Delete

## Scope

Add deterministic local topic rewrite commands:

```text
codealmanac topics rename <old> <new>
codealmanac topics delete <slug>
```

Both commands mutate `.almanac/topics.yaml` and page `topics:` frontmatter.

## Product Semantics

`topics rename <old> <new>`:

- canonicalizes both names to topic slugs
- exits successfully without writes when both slugs are equal
- requires `<old>` to exist unless the operation is unchanged
- refuses if `<new>` already exists, because merge should be explicit
- rewrites the topic entry slug when it exists in `topics.yaml`
- rewrites parent references from `<old>` to `<new>`
- rewrites every page frontmatter topic from `<old>` to `<new>`

`topics delete <slug>`:

- requires the topic to exist
- removes the topic entry from `topics.yaml`
- removes the topic from parent lists
- removes the topic from every page frontmatter
- does not delete pages and does not cascade-delete child topics

## Write Order And Crash Model

Cosmic Python chapter 6 frames Unit of Work as the explicit atomic operation
boundary. Filesystem writes here cannot provide a database rollback, so this
slice uses a smaller operation plan:

1. Refresh the index and validate topic existence/conflicts.
2. Parse all page frontmatter and build page rewrite plans before any write.
3. Mutate `topics.yaml` in memory and validate it.
4. Write `topics.yaml` first with atomic temp+replace.
5. Write affected pages with atomic temp+replace.
6. Refresh the derived SQLite index.

If validation fails, no file is written. If a later page rewrite fails after
`topics.yaml` has been written, the graph file already reflects the intended
state and the command can be re-run to finish page rewrites.

## Architecture

`services/topics` owns policy and service request/result models.

`services/wiki/topics.py` owns `topics.yaml` mutation mechanics.

`services/wiki/frontmatter_rewrite.py` owns page-topic rewrite planning and
page frontmatter writes.

The CLI adapts args and renders compact summaries.

## Tests

- rename updates `topics.yaml`, parent edges, page frontmatter, and read model
- rename refuses an existing target without writing files
- rename works for page-only ad-hoc topics
- delete removes topic entries, parent edges, and page topics without deleting
  pages
- delete refuses missing topics without writing files
- malformed page frontmatter fails before `topics.yaml` changes
- CLI smoke covers rename and delete output
- live temp-repo smoke covers rename/delete/show
