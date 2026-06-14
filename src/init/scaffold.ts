import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

import { findNearestAlmanacDir } from "../paths.js";
import { toKebabCase } from "../slug.js";
import {
  addEntry,
  ensureGlobalDir,
  type RegistryEntry,
} from "../wiki/registry/index.js";
import {
  canonicalTopicsYamlPath,
  canonicalWikiDir,
  legacyTopicsYamlPath,
  runtimeDir,
} from "../wiki/locations.js";

export interface InitOptions {
  cwd: string;
  name?: string;
  description?: string;
}

export interface InitResult {
  entry: RegistryEntry;
  almanacDir: string;
  created: boolean; // false if runtime/content directories already existed
}

/**
 * Scaffold an Almanac runtime directory plus visible docs wiki and register it globally.
 *
 * Idempotent: running `init` on a repo that already has `.almanac/` or
 * `docs/almanac/` is fine — we re-register (refreshing the name/description)
 * and skip anything that already exists. We never overwrite user-authored
 * docs or touch existing pages.
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

  const almanacDir = runtimeDir(repoRoot);
  const wikiDir = canonicalWikiDir(repoRoot);
  const readmePath = join(wikiDir, "README.md");
  const manualDir = join(wikiDir, "_manual");
  const metaDir = join(wikiDir, "_meta");
  const topicsPath = canonicalTopicsYamlPath(repoRoot);

  const alreadyExisted = existsSync(almanacDir) || existsSync(wikiDir);

  await mkdir(almanacDir, { recursive: true });
  await mkdir(manualDir, { recursive: true });
  await mkdir(metaDir, { recursive: true });

  if (!existsSync(readmePath)) {
    await writeFile(readmePath, starterReadme(), "utf8");
  }
  if (!existsSync(topicsPath)) {
    await writeFile(
      topicsPath,
      await starterOrLegacyTopicsYaml(repoRoot),
      "utf8",
    );
  }
  const manualReadme = join(manualDir, "README.md");
  if (!existsSync(manualReadme)) {
    await writeFile(manualReadme, starterManualReadme(), "utf8");
  }
  const conventionsPath = join(metaDir, "wiki-conventions.md");
  if (!existsSync(conventionsPath)) {
    await writeFile(conventionsPath, starterWikiConventions(), "utf8");
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
 * Ensure `.gitignore` in the repo root contains the Almanac-derived
 * runtime files that should never be committed.
 *
 * The SQLite index is derived from markdown pages. Job records are local
 * lifecycle state and JSONL event logs; they can be large and are not wiki
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
    ".almanac/jobs/",
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
 * The starter `docs/almanac/README.md` content. Kept opinionated but short —
 * the user is expected to edit it to fit the repo.
 */
function starterReadme(): string {
  return `---
page_id: codebase-wiki
title: Codebase Wiki
topics: [concepts]
---

# Codebase Wiki

This is the Almanac wiki for this repository. It captures the knowledge
the code itself can't say — decisions, flows, invariants, gotchas, incidents.

The primary reader is a new maintainer: a human joining the repository or an
agent starting with no prior context. Write pages as readable articles that are
also easy for agents to query, verify, and update.

## Where To Start

- Start with this page for the shape of the wiki.
- Read \`_manual/README.md\` before creating or reorganizing pages.
- Read \`_meta/wiki-conventions.md\` before changing local names, folders,
  topics, or recurring section shapes.

## Main Sections

- \`concepts/\` explains the vocabulary a new reader needs first.
- \`architecture/\` explains how the repository works.
- \`guides/\` explains common tasks.
- \`reference/\` records exact public contracts.
- \`decisions/\` records accepted choices and their rationale.
- \`incidents/\` records failures, migrations, and lessons that still matter.
- \`active/\` holds current investigations until they are folded into durable pages.
- \`context/\` holds product, market, competitor, and strategy background.
- \`_manual/\` defines how to maintain this wiki.
- \`_meta/\` records local conventions and coverage notes.

## Runtime State

Readable wiki content lives in \`docs/almanac/\`. Local runtime state lives in
\`.almanac/\`, including the SQLite index and job records.
`;
}

function starterTopicsYaml(): string {
  return `topics:
  - slug: concepts
    title: Concepts
    description: Core vocabulary and mental models for this codebase
    parents: []
  - slug: architecture
    title: Architecture
    description: Repository structure, subsystem boundaries, and runtime flows
    parents: []
  - slug: guides
    title: Guides
    description: Task-oriented documentation for maintainers
    parents: []
  - slug: reference
    title: Reference
    description: Exact public contracts such as commands, formats, and config
    parents: []
  - slug: decisions
    title: Decisions
    description: Accepted choices and the reasoning behind them
    parents: []
  - slug: incidents
    title: Incidents
    description: Failures, migrations, and lessons that still shape work
    parents: []
  - slug: active
    title: Active
    description: Current investigations and design threads not yet folded into durable pages
    parents: []
  - slug: context
    title: Context
    description: Product, market, competitor, and strategy background
    parents: []
`;
}

async function starterOrLegacyTopicsYaml(repoRoot: string): Promise<string> {
  const legacyPath = legacyTopicsYamlPath(repoRoot);
  if (existsSync(legacyPath)) {
    return readFile(legacyPath, "utf8");
  }
  return starterTopicsYaml();
}

function starterManualReadme(): string {
  return `---
page_id: wiki-manual
title: Wiki Manual
topics: []
---

# Wiki Manual

This manual defines how this codebase wiki should be written and maintained.
Read it before creating, moving, merging, or substantially rewriting pages.

The wiki should read like careful documentation for a new maintainer. It should
also remain queryable by agents through \`page_id\`, topics, wikilinks, source
records, and citations.
`;
}

function starterWikiConventions(): string {
  return `---
page_id: wiki-conventions
title: Wiki Conventions
topics: []
---

# Wiki Conventions

This file records local conventions for this repository's Almanac wiki. Update
it when the wiki develops naming, folder, source, citation, or linking rules
that future maintainers should follow.

## Starting Rules

- Use \`docs/almanac/\` for readable wiki content.
- Use \`.almanac/\` for runtime state such as \`index.db\` and jobs.
- Use \`_manual/\` for wiki doctrine and \`_meta/\` for local maintenance notes.
- Prefer stable \`page_id\` values so files can move without changing links.
`;
}
