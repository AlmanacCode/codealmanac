# Slice 4 — Bootstrap (first Agent SDK integration)

Fourth implementation slice of codealmanac. Builds on slices 1-3. Introduces the Claude Agent SDK for the first time.

## Read before coding

1. **SDK implementation reference (read FIRST):** `~/Desktop/Projects/codealmanac/docs/research/agent-sdk.md`
   Contains version to pin, auth pattern, full `query()` signature, message types, streaming format, pitfalls. Written specifically so this slice doesn't have to research the SDK from scratch.

2. **Design spec:** `/Users/rohan/Desktop/Projects/openalmanac/docs/ideas/codebase-wiki.md`
   Focus on: Design Philosophy ("intelligence in the prompt, not in the pipeline"), Bootstrap section.

3. **The bootstrap prompt that drives the agent:** `~/Desktop/Projects/codealmanac/prompts/bootstrap.md`
   Read in full. This is what the agent reads at runtime — you're building the harness that delivers it.

4. **GUI precedent** (already summarized in the SDK reference above, read only if you need more context):
   - `/Users/rohan/Desktop/Projects/openalmanac/gui/process-manager.js` — `_startProcess` / `_iterateProcess` lifecycle
   - `/Users/rohan/Desktop/Projects/openalmanac/gui/main/agent-definitions.js` — `AgentDefinition` examples

5. **Existing codealmanac code** — match the command pattern from slice 2 (e.g., `reindex` is a similar "do work, then exit" shape).

## Scope

One command:

```bash
almanac bootstrap                       # default: run bootstrap agent on current repo
almanac bootstrap --quiet               # suppress streaming output; errors only
almanac bootstrap --model <model>       # override model (default: claude-sonnet-4-5 or latest)
```

**What it does:**

1. Verify current directory is inside a repo (has `.git/` or the user passed explicit `--path`)
2. Verify `.almanac/` doesn't already have pages — if it does, refuse with:
   `error: .almanac/ already initialized with N pages. Bootstrap is for empty wikis. Use 'almanac capture' instead.`
   (Override with `--force` if the user really wants to re-run.)
3. Ensure `almanac init` has been run (if not, run it silently first with defaults)
4. Load `prompts/bootstrap.md` (bundled in the npm package)
5. Invoke `query()` from `@anthropic-ai/claude-agent-sdk` with:
   - `systemPrompt`: the bootstrap prompt text
   - `prompt`: "Begin the bootstrap now. Working directory: <repo-root>."
   - `allowedTools`: `["Read", "Write", "Edit", "Glob", "Grep", "Bash"]`
     - (No `Agent` — bootstrap has no subagents)
     - Bash should be scoped to `almanac` subcommands if possible; otherwise give full Bash and trust the prompt
   - `cwd`: repo root
   - `mcpServers`: `{}` (none needed)
6. Stream messages to stdout (or suppress if `--quiet`)
7. Exit after the async generator finishes

The agent reads `package.json` / `pyproject.toml` / `docker-compose.yml` / `README.md` / `CLAUDE.md` etc., creates `.almanac/README.md` + `.almanac/pages/*.md` stubs, sets up `.almanac/topics.yaml`. It handles all the logic via the prompt.

## Out of scope

- `almanac capture` (slice 5)
- SessionEnd hook wiring (slice 5)
- `almanac graph` / `almanac diff` (later)
- Multi-wiki bootstrap (single repo at a time)

## Tech — new dependencies

```
"@anthropic-ai/claude-agent-sdk": "^latest"
```

Check the latest stable version on npm. The GUI uses it; match or exceed that version. Verify it's ESM-compatible (should be).

You may also need:
```
"@anthropic-ai/sdk": "^latest"   // peer dependency, sometimes implicit
```

Check the agent SDK's package.json for peer/required deps.

## Implementation structure

```
src/
  agent/
    sdk.ts                  # thin wrapper around query() — hides SDK specifics,
                            # exposes runAgent({systemPrompt, prompt, allowedTools, agents, cwd, onMessage})
    prompts.ts              # loads bundled prompts (bootstrap.md, writer.md, reviewer.md)
                            # resolves paths correctly whether run from source or installed
  commands/
    bootstrap.ts            # the command itself
prompts/
  bootstrap.md              # already present
  writer.md                 # already present
  reviewer.md               # already present
```

### `src/agent/sdk.ts` — the wrapper

Small, opinionated wrapper around `query()`:

```typescript
import { query, type AgentDefinition } from "@anthropic-ai/claude-agent-sdk";

export interface RunAgentOptions {
  systemPrompt: string;
  prompt: string;
  allowedTools: string[];
  agents?: Record<string, AgentDefinition>;
  cwd: string;
  model?: string;
  onMessage?: (msg: unknown) => void;
}

export interface AgentResult {
  success: boolean;
  cost: number;
  turns: number;
  error?: string;
}

export async function runAgent(opts: RunAgentOptions): Promise<AgentResult> {
  const q = query({
    prompt: opts.prompt,
    options: {
      systemPrompt: opts.systemPrompt,
      allowedTools: opts.allowedTools,
      agents: opts.agents ?? {},
      cwd: opts.cwd,
      model: opts.model,
      maxTurns: 100,
    },
  });

  let cost = 0;
  let turns = 0;
  let errorMsg: string | undefined;

  try {
    for await (const msg of q) {
      opts.onMessage?.(msg);
      // Track cost/turns from SDK message envelope — exact schema depends on SDK version
    }
    return { success: true, cost, turns };
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, cost, turns, error: errorMsg };
  }
}
```

Keep this module small. It's the only place the SDK API touches. Slice 5 imports it too.

### `src/agent/prompts.ts` — load bundled prompts

The prompts live in `prompts/` at the repo root during dev, and are included in the npm package via `package.json`'s `files` field (already set: `["dist", "prompts", "README.md", "LICENSE"]`).

Resolve the path relative to the package install location:

```typescript
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const PROMPTS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../prompts" // from dist/ to prompts/ — adjust based on actual bundle layout
);

export async function loadPrompt(name: "bootstrap" | "writer" | "reviewer"): Promise<string> {
  return readFile(path.join(PROMPTS_DIR, `${name}.md`), "utf-8");
}
```

Verify this path resolution works when installed via `npm link` AND when running from source (`npm run dev` → uses ts-node or similar). Test in both.

### `src/commands/bootstrap.ts` — the command

Flow:

```typescript
export async function runBootstrap(opts: BootstrapOptions): Promise<CommandResult> {
  // 1. Resolve repo root (prefer existing .almanac/, else git root, else cwd)
  // 2. Check .almanac/pages/ content — refuse if not empty unless --force
  // 3. Run almanac init silently if .almanac/ doesn't exist yet
  // 4. Load bootstrap prompt
  // 5. Build prompt context: "Working directory: <repoRoot>. Begin the bootstrap."
  // 6. Call runAgent() with Read/Write/Edit/Glob/Grep/Bash tools
  // 7. Stream messages via onMessage unless --quiet
  // 8. Return success/failure
}
```

**Streaming**: SDK messages include assistant text, tool calls, tool results. Format them human-readably for the default output. Suggested format:

```
[bootstrap] reading package.json
[bootstrap] reading CLAUDE.md
[bootstrap] identified anchors: Next.js, FastAPI, Supabase, Meilisearch, OpenAI SDK
[bootstrap] writing .almanac/pages/nextjs.md
[bootstrap] writing .almanac/pages/fastapi.md
[bootstrap] writing .almanac/pages/supabase.md
[bootstrap] writing .almanac/topics.yaml
[bootstrap] writing .almanac/README.md
[bootstrap] done (4 pages, 6 topics, cost: $0.03)
```

Don't print every token — just the tool calls and major milestones. Full transcript goes to `.almanac/.bootstrap-<session>.log` so the user can inspect later if needed.

`--quiet` mode: only prints errors and the final line.

## Design rules (non-negotiable)

- **No proposal file. No `--dry-run`. No `--apply`.** The agent reads the repo and writes the stubs directly. Done. If the user wants to re-run, delete files and run again.
- **Prompt carries the intelligence.** Do not add heuristics in code for dep grouping, anchor identification, topic proposal. The prompt handles it.
- **Bundled prompts live in `prompts/`** and ship with the npm package. Do not fetch from URLs at runtime.
- **Silent auto-init.** If `.almanac/` doesn't exist, run init with defaults (no prompts). Failure should be loud.
- **Refuse to overwrite a populated wiki.** Unless `--force`, refuse if `.almanac/pages/` has any `.md` files.
- **Tools scoped tight.** `Read`, `Write`, `Edit`, `Glob`, `Grep`, `Bash`. The agent doesn't need WebFetch, Task, or MCP servers for bootstrap.

## Authentication

**The SDK requires `ANTHROPIC_API_KEY` env var in headless mode.** (The earlier assumption that it reads Claude Code's local auth store is incorrect — see `docs/research/agent-sdk.md` §2.)

Gate upfront before calling `query()`:

```typescript
if (!process.env.ANTHROPIC_API_KEY) {
  console.error("error: ANTHROPIC_API_KEY is required for almanac bootstrap.");
  console.error("export ANTHROPIC_API_KEY=sk-ant-...");
  process.exit(1);
}
```

The SDK throws mid-stream on missing auth, which is a bad UX. Always check first.

## Testing

Integration tests for `bootstrap` are hard because they require a real Claude call. Options:

1. **Mock the SDK** in unit tests: replace `runAgent` with a fake that writes a predictable set of files. Tests that the command wiring (flag parsing, init prerequisite, force check, output formatting) works.
2. **A real end-to-end test** as a manual verification step, not in CI.

Do both:
- Unit tests for the command logic with `runAgent` mocked
- Manual verification: run `almanac bootstrap` in a small sample repo (create one in `/tmp/bootstrap-test`) and verify the output

Verify:
- Refuses to run if `.almanac/pages/` has pages (without `--force`)
- Runs silently through `init` if `.almanac/` doesn't exist
- Proper error message if auth missing
- `--quiet` suppresses streaming
- `.bootstrap-<session>.log` is written regardless

## What "done" looks like

```bash
cd /tmp/bootstrap-test
cat > package.json << 'EOF'
{
  "name": "test-app",
  "dependencies": {
    "next": "^15.0.0",
    "@supabase/supabase-js": "^2.0.0",
    "stripe": "^17.0.0"
  }
}
EOF
cat > README.md << 'EOF'
# Test App
A Next.js app with Supabase and Stripe.
EOF
mkdir -p src/lib
echo "// supabase client" > src/lib/supabase.ts
echo "// stripe client" > src/lib/stripe.ts
git init

almanac bootstrap
# [bootstrap] reading package.json...
# [bootstrap] reading README.md...
# [bootstrap] identified anchors: Next.js, Supabase, Stripe
# [bootstrap] writing .almanac/pages/nextjs.md
# [bootstrap] writing .almanac/pages/supabase.md
# [bootstrap] writing .almanac/pages/stripe.md
# [bootstrap] writing .almanac/topics.yaml
# [bootstrap] writing .almanac/README.md
# [bootstrap] done (3 pages, 4 topics, cost: $0.02)

ls .almanac/pages/
# nextjs.md  supabase.md  stripe.md

cat .almanac/topics.yaml
# topics:
#   - slug: stack
#     ...

almanac list
# test-app — A Next.js app with Supabase and Stripe.
#   /tmp/bootstrap-test

almanac search --topic stack
# → nextjs, supabase, stripe

almanac search --mentions src/lib/supabase.ts
# → supabase

# Refuse to re-run:
almanac bootstrap
# error: .almanac/ already initialized with 3 pages. Use 'almanac capture' instead, or --force to overwrite.

# Force overwrite:
almanac bootstrap --force
# (runs again, writes fresh stubs)

# Quiet mode:
rm -rf .almanac
almanac bootstrap --quiet
# (no output until done, final line shown)
```

## Commit template

```
feat(slice-4): almanac bootstrap via Claude Agent SDK

- src/agent/sdk.ts: thin wrapper around @anthropic-ai/claude-agent-sdk query()
- src/agent/prompts.ts: loads bundled prompts (bootstrap/writer/reviewer)
- src/commands/bootstrap.ts: runs bootstrap prompt with scoped tools
- Refuses to overwrite populated wikis; --force opt-in
- Streams tool calls + writes full transcript to .bootstrap-<session>.log
- Authentication delegated to Claude Code's existing auth store
```

Push to origin/main.

## Report format

1. What was built (files + commands + dependencies added)
2. `npm test` output (unit tests + mocked SDK)
3. Manual end-to-end verification (real bootstrap on a small test repo)
4. Git commit hash + push confirmation
5. Judgment calls — especially: SDK version chosen, how tool scoping works in practice, how streaming output is formatted, any SDK quirks discovered
