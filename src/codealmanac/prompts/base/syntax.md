# Wiki Syntax

Pages are Markdown files under the repo's `almanac/` tree, with YAML
frontmatter. The page id is the path under `almanac/` without `.md`.
`README.md` is the landing page for its folder.

Use `topics:` for topic slugs. Use structured `sources:` entries for evidence
that supports non-obvious claims.

Use normal Markdown links for page links. Link only to existing pages or pages
you create or update in this run. If no page exists and you are not creating
it, write the name as plain text instead of leaving a broken link.

Do not use double-bracket links. File and folder evidence belongs in `sources:`
entries with `type: file`.

Every sentence should contain a specific fact. Prefer neutral prose. Do not
speculate. Do not add promotional language.

Update only source files inside `almanac/` unless the operation explicitly says
otherwise. Do not edit application code during lifecycle wiki operations.
