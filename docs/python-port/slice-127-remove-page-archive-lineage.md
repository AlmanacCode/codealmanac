# Slice 127: Remove Page Archive Lineage

## Scope

Remove archive/supersede page lineage from the active Python product model.
Git history is the archive for CodeAlmanac v1.

## Out of scope

- No behavior changes to `archive/code/`, archived reference docs, or run-log
  page-change summaries.
- No viewer redesign.
- No migration from old page formats; Python v1 targets new users.

## Design

The live agreement says not to keep `archived_at`, `superseded_by`,
`supersedes`, `--include-archive`, or `--archived` as product concepts. The
current Python code still stores page archive columns in the derived index and
exposes archive search flags. That makes the implementation disagree with the
contract.

Cosmic Python chapter 2 frames a repository as "a simplifying abstraction over
data storage"; here the index store should hide only the derived read model we
actually support, not persist removed product state. Chapter 4 separates
"orchestration logic, business logic, and interfacing code"; here the parser,
request model, service request, and index query must agree on the same
archive-free use case.

The new shape is:

```python
wiki.frontmatter       # parses current supported frontmatter; archive keys ignored
wiki.documents         # builds PageDocument without lineage fields
index.schema           # pages table stores current page read model only
index.search_views     # search filters current pages; no archive flags
cli.parser.wiki        # public search flags are query/topic/mentions/limit/json
```

Architecture tests should enforce that active Python source does not regrow
page archive lineage fields or public archive search flags.

## Verification

- Frontmatter parsing tests prove obsolete archive keys are ignored.
- CLI parser tests prove `search --include-archive` and `search --archived` are
  rejected.
- Architecture guard rejects page archive lineage fragments in active Python
  source.
- Focused search/index/wiki tests plus full pytest, ruff, and diff checks.
