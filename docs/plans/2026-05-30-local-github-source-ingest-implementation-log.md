# Local GitHub Source Ingest Implementation Log

This log records implementation progress for `docs/plans/2026-05-30-local-github-source-ingest.md`.

## 2026-05-30

- Created branch `codex/local-github-source-ingest` from `dev`.
- Preserved existing dirty wiki/research files in the branch rather than switching away from them.
- Cleaned stale plan terminology from `SourceAddress` / `SourceBrief` to the settled `SourceRef` / `Source` split.
- Implementation target remains local-only `almanac ingest github:pr:<number>` using `gh` during Absorb, with no Composio, no hosted GitHub App, no prefetch artifact, and no dedupe in v1.
- Implemented `src/ingest/source-ref.ts` with tests for GitHub PR refs, malformed PR refs, unsupported GitHub issue refs, and normal path pass-through.
- Implemented `src/ingest/github.ts` with tests for HTTPS/SSH GitHub remote parsing, non-GitHub remote rejection, `gh` missing guidance, and `gh auth status` guidance.
- Wired source refs into `runIngestCommand()` while preserving path ingest. Mixed path/source input is rejected for v1.
- Updated ingest CLI help from path-only language to "files, folders, or source refs".
- Focused verification run after wiring: `test/github-source-resolver.test.ts`, `test/operation-commands.test.ts`, and `test/cli.test.ts` all passed.
- Code review found that missing `origin` should get the clear GitHub-remote setup message and that suggested `gh pr` commands should include `--repo owner/repo`; both were fixed with tests.
