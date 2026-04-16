import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

import { getRepoAlmanacDir } from "../paths.js";
import {
  addEntry,
  ensureGlobalDir,
  toKebabCase,
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
 */
export async function initWiki(options: InitOptions): Promise<InitResult> {
  const { cwd } = options;
  const almanacDir = getRepoAlmanacDir(cwd);
  const pagesDir = join(almanacDir, "pages");
  const readmePath = join(almanacDir, "README.md");

  const alreadyExisted = existsSync(almanacDir);

  await mkdir(pagesDir, { recursive: true });

  if (!existsSync(readmePath)) {
    await writeFile(readmePath, starterReadme(), "utf8");
  }

  await ensureGitignoreHasIndexDb(cwd);

  const name = toKebabCase(options.name ?? basename(cwd));
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
    path: cwd,
    registered_at: new Date().toISOString(),
  };
  await addEntry(entry);

  return { entry, almanacDir, created: !alreadyExisted };
}

/**
 * Ensure `.gitignore` in the repo root contains `.almanac/index.db`.
 *
 * The index is a derived SQLite file — it would churn every reindex and
 * bloat git history. We add the line regardless of whether the file
 * exists (creating `.gitignore` if needed), but only once. If the line is
 * already present under any reasonable variant, we leave the file alone.
 */
async function ensureGitignoreHasIndexDb(cwd: string): Promise<void> {
  const path = join(cwd, ".gitignore");
  const target = ".almanac/index.db";

  let existing = "";
  if (existsSync(path)) {
    existing = await readFile(path, "utf8");
  }

  // Normalize to line comparison to avoid false negatives on trailing
  // whitespace or CRLF line endings.
  const lines = existing.split(/\r?\n/).map((l) => l.trim());
  if (lines.includes(target)) return;

  const prefix = existing.length === 0 || existing.endsWith("\n") ? "" : "\n";
  const block = `${prefix}${existing.length === 0 ? "" : "\n"}# codealmanac\n${target}\n`;

  await writeFile(path, existing + block, "utf8");
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
