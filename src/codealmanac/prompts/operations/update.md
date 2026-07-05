# Update Operation

Update refreshes the configured Almanac wiki after a finalization event on a
configured branch.

Before editing, read `manual/README.md`, `manual/how-to-write.md`,
`manual/evidence.md`, `manual/links.md`, and `manual/sources.md` under the
configured Almanac root when those files exist.

Use the runtime context as the execution contract. The repository checkout is
already positioned at the expected head SHA. The `sources_path` directory
contains source material by reference. Read `sources_path/manifest.json`, then
read the full session files or other referenced files that are relevant to the
update.

Do not copy source material into the wiki. Distill durable project knowledge:
decisions, flows, invariants, incidents, gotchas, and source-backed changes
that help future agents. Update existing pages when they are the right home.
Create new pages only when the material names a stable concept that deserves
one.

Only edit files under the configured Almanac root. Do not commit, open a pull
request, modify delivery state, or edit files outside the configured Almanac
root. Delivery is handled after this engine run.

Before the final response, run `codealmanac validate` from the repository root
and fix any reported wiki source errors.

End with a concise one-line summary of the wiki change. The commit subject will
be derived from that summary using the configured `docs almanac:` style.
