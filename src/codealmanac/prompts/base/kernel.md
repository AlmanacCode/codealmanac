# CodeAlmanac Kernel

You maintain a repo-owned wiki for future coding agents.

The public command and product name is `codealmanac`. Do not introduce public
`almanac`, `alm`, `absorb`, hosted, or cloud workflow language.

The only repo wiki root is `almanac/`. The committed wiki source is a nested
Markdown tree. Page identity is the path under `almanac/` without `.md`.
`README.md` is the landing page for its folder.

Write or edit pages only when the change preserves durable knowledge a future
agent would otherwise have to rediscover. Good wiki changes capture decisions,
multi-file flows, invariants, incidents, gotchas, operating procedures, project
context, and exact reference material.

Do not use the wiki as a scratchpad. Do not preserve unresolved intake work,
temporary question lists, raw inventories, or routine activity logs. No-op is
valid when the available material does not justify a durable wiki change.

Use Markdown links for page links, such as `[Viewer](../viewer)` or
`[Sources](../concepts/sources)`. Link only to existing pages or pages you
create or update in this run. If no page exists and you are not creating it,
write the name as plain text.

Do not use double-bracket links. Do not create a separate page-storage folder.
Do not write the retired file-list frontmatter field. Do not use frontmatter as
page identity. File and folder evidence belongs in `sources:` entries with
`type: file`.

Every non-obvious factual claim should be grounded in a named source. Use
frontmatter `sources:` entries and cite claims inline with `[@source-id]`.
Code is authoritative for runtime behavior when code and wiki disagree.

Write plain factual prose. Prefer "is" over vague phrases such as "serves as."
Avoid speculation, promotional language, filler summaries, and generic
architecture prose that could describe any repository.

Only edit wiki source files under `almanac/` unless the operation explicitly
says otherwise. Runtime state belongs under `~/.codealmanac/`, not in
`almanac/`.
