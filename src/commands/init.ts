import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

import { findNearestAlmanacDir, getRepoAlmanacDir } from "../paths.js";
import { toKebabCase } from "../slug.js";
import {
  addEntry,
  ensureGlobalDir,
  type RegistryEntry,
} from "../registry/index.js";

export interface InitOptions {
  cwd: string;
  name?: string;
  description?: string;
}

export interface InitResult {
  entry: RegistryEntry;
  almanacDir: string;
  created: boolean; // false if .almanac/ already existed (idempotent re-init)
}

/**
 * Scaffold `.almanac/` in the repo and register it globally.
 *
 * Idempotent: running `init` on a repo that already has `.almanac/` is
 * fine — we re-register (refreshing the name/description) and skip
 * anything that already exists. We never overwrite a user-authored
 * `README.md` or touch existing pages.
 *
 * If `cwd` lives inside a subdirectory of an existing wiki, we walk up to
 * the wiki root and operate there. `almanac init` from `src/nested/`
 * should update the enclosing wiki, not create a nested one at
 * `src/nested/.almanac/` (which would fragment the registry and leave a
 * confusing orphan `.almanac/` on disk).
 */
export async function initWiki(options: InitOptions): Promise<InitResult> {
  // If cwd is already inside a wiki, prefer that root. Otherwise treat
  // cwd as the new wiki root.
  const repoRoot = findNearestAlmanacDir(options.cwd) ?? options.cwd;

  const almanacDir = getRepoAlmanacDir(repoRoot);
  const pagesDir = join(almanacDir, "pages");
  const readmePath = join(almanacDir, "README.md");

  const alreadyExisted = existsSync(almanacDir);

  await mkdir(pagesDir, { recursive: true });

  if (!existsSync(readmePath)) {
    await writeFile(readmePath, starterReadme(), "utf8");
  }

  await ensureGitignoreHasRuntimeArtifacts(repoRoot);

  const name = toKebabCase(options.name ?? basename(repoRoot));
  if (name.length === 0) {
    throw new Error(
      "could not derive a wiki name from the current directory; pass --name",
    );
  }

  const description = (options.description ?? "").trim();

  await ensureGlobalDir();
  const entry: RegistryEntry = {
    name,
    description,
    path: repoRoot,
    registered_at: new Date().toISOString(),
  };
  await addEntry(entry);

  return { entry, almanacDir, created: !alreadyExisted };
}

/**
 * Ensure `.gitignore` in the repo root contains the CodeAlmanac-derived
 * runtime files that should never be committed.
 *
 * The SQLite index is derived from markdown pages. Run records are local
 * process state and JSONL event logs; they can be large and are not wiki
 * content.
 *
 * We add the block regardless of whether the file exists (creating
 * `.gitignore` if needed), and we add any target lines that aren't
 * already present. Existing targets are left alone. If none of the
 * target lines need adding, the file is not touched at all.
 *
 * Formatting: when we do append, we guarantee exactly one blank line
 * between the prior content and our appended block. If the `# codealmanac`
 * header is already present but new targets need adding, we just append
 * the missing lines (no duplicate header).
 */
async function ensureGitignoreHasRuntimeArtifacts(cwd: string): Promise<void> {
  const path = join(cwd, ".gitignore");
  const targets = [
    ".almanac/index.db",
    ".almanac/index.db-wal",
    ".almanac/index.db-shm",
    ".almanac/runs/",
  ];

  let existing = "";
  if (existsSync(path)) {
    existing = await readFile(path, "utf8");
  }

  // Normalize to line comparison to avoid false negatives on trailing
  // whitespace or CRLF line endings.
  const lines = existing.split(/\r?\n/).map((l) => l.trim());
  const missing = targets.filter((t) => !lines.includes(t));
  if (missing.length === 0) return;

  const hasHeader = lines.includes("# codealmanac");
  const block = hasHeader
    ? missing.join("\n") + "\n"
    : `# codealmanac\n${missing.join("\n")}\n`;

  // Three cases for the separator before the appended block:
  //  - empty file: no separator needed
  //  - ends with newline: one more newline produces a single blank line
  //  - no trailing newline: two newlines (one to terminate the last line,
  //    one for the blank separator)
  const sep =
    existing.length === 0 ? "" : existing.endsWith("\n") ? "\n" : "\n\n";
  await writeFile(path, `${existing}${sep}${block}`, "utf8");
}

/**
 * The starter `.almanac/README.md` content. Based on the "Wiki README" and
 * "Notability bar" sections of the design spec. Kept opinionated but short
 * (~70 lines) — the user is expected to edit it to fit the repo.
 */
function starterReadme(): string {
  return `# Wiki

This is the codealmanac wiki for this repository. It captures the knowledge
the code itself can't say — decisions, flows, invariants, gotchas, incidents.

The primary reader is an AI coding agent. The secondary reader is a human
skimming to understand the shape of the codebase. Write accordingly: dense,
factual, linked.

## Notability bar

Write a page when there is **non-obvious knowledge that will help a future
agent**. Specifically:

- A decision that took discussion, research, or trial-and-error
- A gotcha discovered through failure
- A cross-cutting flow that spans multiple files and isn't obvious from any
  one of them
- A constraint or invariant not visible from the code
- An entity (technology, service, system) referenced by multiple pages

Do not write pages that restate what the code does. Do not write pages of
inference — only of observation. Silence is an acceptable outcome.

## Topic taxonomy

Topics form a DAG; pages can belong to multiple topics. Start with these and
grow as the wiki does:

- \`stack\` — technologies and services we use (frameworks, databases, APIs)
- \`systems\` — custom systems we built (auth, billing, search)
- \`flows\` — multi-file processes end-to-end (checkout-flow, publish-flow)
- \`decisions\` — "why X over Y"
- \`incidents\` — recorded failures and their fixes
- \`concepts\` — shared vocabulary specific to this codebase

Domain topics (\`auth\`, \`payments\`, \`frontend\`, \`backend\`) live alongside
these. A page about JWT rotation belongs to both \`auth\` and \`decisions\`.

## Page shapes

Four shapes cover most of what gets written. They are suggestions, not a
schema — a page that fits none of them is fine.

- **Entity** — a stable named thing (Supabase, Stripe, the search service)
- **Decision** — why we chose X over Y
- **Flow** — how a multi-file process works end-to-end
- **Gotcha** — a specific surprise, failure, or constraint

## Writing conventions

- Every sentence contains a specific fact. If it doesn't, cut it.
- Neutral tone. "is", not "serves as". No "plays a pivotal role", no
  interpretive "-ing" clauses, no vague attribution ("experts argue").
- No hedging or knowledge-gap disclaimers. If you don't know, don't write
  the sentence.
- Prose first. Bullets for genuine lists. Tables only for structured
  comparison.
- No formulaic conclusions. End with the last substantive fact.

## Linking

One \`[[...]]\` syntax for everything, disambiguated by content:

- \`[[checkout-flow]]\` — page slug
- \`[[src/checkout/handler.ts]]\` — file reference
- \`[[src/checkout/]]\` — folder reference (trailing slash)
- \`[[other-wiki:slug]]\` — cross-wiki reference

Every page should link to at least one entity when possible. A page with no
entity link is suspect.

## Pages live in \`.almanac/pages/\`

One markdown file per page, kebab-case slug. Frontmatter carries \`topics:\`
and optional \`files:\`. The rest is prose.
`;
}
