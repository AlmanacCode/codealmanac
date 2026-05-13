import { join } from "node:path";

import { BLUE, DIM, RST } from "../ansi.js";
import { ensureFreshIndex } from "../indexer/index.js";
import { resolveWikiRoot } from "../indexer/resolve-wiki.js";
import { openIndex } from "../indexer/schema.js";
import { getPageView, type PageView } from "../query/page-view.js";

/**
 * `almanac show <slug>` — structured view of a page.
 *
 * This file absorbs what used to be split across `show` (body), `info`
 * (metadata), and `path` (file path resolution). One command, multiple
 * view flags.
 *
 * Three output "shapes":
 *
 *   1. **Default** — body only. This keeps the core read path terse and
 *      pipe-friendly; `--verbose` restores the metadata header.
 *   2. **View flags** (mutually exclusive-ish):
 *        --json   structured JSON, overrides everything else
 *        --body   body only (`--raw` is a deprecated CLI alias)
 *        --meta   metadata only, no body
 *        --lead   first paragraph of body only (cheap preview)
 *   3. **Field flags** (composable). Each selects one "field" of the page:
 *        --title / --topics / --files / --links / --backlinks / --xwiki
 *        --lineage / --updated / --path
 *      A single field → bare, pipe-friendly output (one item per line).
 *      Multiple fields → labeled sections, one per flag.
 *
 * `--stdin` is always JSON Lines (one record per line). This avoids the
 * separator ambiguity with markdown `---` in bulk output: the old `info`
 * used a human-readable array; the old `show` used `\n---\n` which
 * collided with page frontmatter delimiters.
 */
export interface ShowOptions {
  cwd: string;
  slug?: string;
  stdin?: boolean;
  stdinInput?: string;
  wiki?: string;

  // View modes (mutually exclusive-ish — precedence: json > raw > meta > lead > default).
  json?: boolean;
  raw?: boolean; // alias: body
  meta?: boolean;
  lead?: boolean;
  verbose?: boolean;

  // Composable field flags.
  title?: boolean;
  topics?: boolean;
  files?: boolean;
  links?: boolean;
  backlinks?: boolean;
  xwiki?: boolean;
  lineage?: boolean;
  updated?: boolean;
  path?: boolean;
}

export interface ShowCommandOutput {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * The structured record emitted by `--json`. Also the shape we read into
 * in order to compose any other output. Keeping this a plain flat object
 * means callers can JSON.parse downstream tooling without chasing nested
 * subschemas.
 */
export type ShowRecord = PageView;

export async function runShow(
  options: ShowOptions,
): Promise<ShowCommandOutput> {
  const repoRoot = await resolveWikiRoot({
    cwd: options.cwd,
    wiki: options.wiki,
  });
  await ensureFreshIndex({ repoRoot });

  const dbPath = join(repoRoot, ".almanac", "index.db");
  const db = openIndex(dbPath);

  try {
    const slugs = collectSlugs(options);
    if (slugs.length === 0) {
      return {
        stdout: "",
        stderr: "almanac: show requires a slug (or --stdin)\n",
        exitCode: 1,
      };
    }

    const records: ShowRecord[] = [];
    const missing: string[] = [];
    for (const slug of slugs) {
      const rec = await getPageView(db, slug);
      if (rec === null) {
        missing.push(slug);
        continue;
      }
      records.push(rec);
    }

    const bulk = options.stdin === true;
    const stdout = bulk
      ? formatBulk(records)
      : formatSingle(records, options);

    const stderr = missing
      .map((s) => `almanac: no such page "${s}"\n`)
      .join("");

    return {
      stdout,
      stderr,
      exitCode: missing.length > 0 ? 1 : 0,
    };
  } finally {
    db.close();
  }
}

// ─── Formatting ──────────────────────────────────────────────────────

function formatBulk(records: ShowRecord[]): string {
  // JSON Lines. One record per line, trailing newline when non-empty.
  // Consumers split on `\n` and `JSON.parse` each line.
  if (records.length === 0) return "";
  return records.map((r) => JSON.stringify(r)).join("\n") + "\n";
}

function formatSingle(
  records: ShowRecord[],
  options: ShowOptions,
): string {
  if (options.json === true) {
    // JSON always wins. Positional mode emits a single object (never an
    // array) for a found page, `null` for a missing one — matches the
    // shape contract from the old `info --json`.
    const only = records[0] ?? null;
    return `${JSON.stringify(only, null, 2)}\n`;
  }
  return records.map((r) => formatRecord(r, options)).join("");
}

/**
 * Figure out which fields the user asked for. Precedence:
 *   1. Body-only mode — everything else is ignored.
 *   2. `--meta` — metadata only, no body. Ignores `--lead`.
 *   3. `--lead` — first paragraph only.
 *   4. Any field flag (`--title`, `--topics`, …) set → those fields only.
 *   5. Nothing set → body only, unless --verbose asks for full view.
 */
type FieldName =
  | "title"
  | "topics"
  | "files"
  | "links"
  | "backlinks"
  | "xwiki"
  | "lineage"
  | "updated"
  | "path";

const FIELD_ORDER: FieldName[] = [
  "title",
  "topics",
  "files",
  "links",
  "backlinks",
  "xwiki",
  "lineage",
  "updated",
  "path",
];

function selectedFields(options: ShowOptions): FieldName[] {
  const selected: FieldName[] = [];
  for (const f of FIELD_ORDER) {
    if (options[f] === true) selected.push(f);
  }
  return selected;
}

function formatRecord(rec: ShowRecord, options: ShowOptions): string {
  // 1. raw / body
  if (options.raw === true) {
    // Guarantee exactly one trailing newline. Without it, shell redirects
    // (`almanac show foo --body > foo.md`) produce files missing a final
    // newline, which confuses concatenation and diff tools. We don't
    // collapse multiple trailing newlines — a page that ends with a
    // blank line is intentional.
    return bodyOnly(rec);
  }

  // 4. Field flags (check before meta/lead so --meta + --title is unambiguous).
  const fields = selectedFields(options);
  if (fields.length > 0) {
    if (fields.length === 1) {
      return bareField(rec, fields[0]!);
    }
    return labeledFields(rec, fields);
  }

  // 2. meta only
  if (options.meta === true) {
    return metadataHeader(rec) + "\n";
  }

  // 3. lead only
  if (options.lead === true) {
    return firstParagraph(rec.body) + "\n";
  }

  if (options.verbose !== true) {
    return bodyOnly(rec);
  }

  // 5. Verbose — metadata header + separator + body.
  const header = metadataHeader(rec);
  const body = rec.body;
  const sep = body.length > 0 ? `\n\n${DIM}---${RST}\n\n` : "\n";
  return header + sep + body;
}

function bodyOnly(rec: ShowRecord): string {
  if (rec.body.length === 0) return "";
  return rec.body.endsWith("\n") ? rec.body : `${rec.body}\n`;
}

/**
 * Single-field bare output. One item per line, no labels, no colons —
 * designed to be piped directly into another command. The exact format
 * per field tries to preserve "scriptable by default":
 *
 *   --title      → the title (or empty if null)
 *   --topics     → one topic slug per line
 *   --files      → one file ref per line; trailing slash for folders
 *   --links      → one outgoing slug per line
 *   --backlinks  → one incoming slug per line
 *   --xwiki      → one `wiki:slug` per line
 *   --lineage    → archived_at / supersedes / superseded_by, one per line
 *                  (only the ones that exist — silent when all absent)
 *   --updated    → ISO-8601 UTC timestamp
 *   --path       → absolute file path (replaces the old `almanac path`)
 */
function bareField(rec: ShowRecord, field: FieldName): string {
  switch (field) {
    case "title":
      return (rec.title ?? "") + "\n";
    case "topics":
      return rec.topics.map((t) => `${t}\n`).join("");
    case "files":
      return rec.file_refs
        .map((r) => `${r.path}\n`)
        .join("");
    case "links":
      return rec.wikilinks_out.map((t) => `${t}\n`).join("");
    case "backlinks":
      return rec.wikilinks_in.map((t) => `${t}\n`).join("");
    case "xwiki":
      return rec.cross_wiki_links
        .map((x) => `${x.wiki}:${x.target}\n`)
        .join("");
    case "lineage": {
      const lines: string[] = [];
      if (rec.archived_at !== null) {
        lines.push(
          `archived_at: ${new Date(rec.archived_at * 1000).toISOString()}`,
        );
      }
      if (rec.superseded_by !== null) {
        lines.push(`superseded_by: ${rec.superseded_by}`);
      }
      if (rec.supersedes.length > 0) {
        lines.push(`supersedes: ${rec.supersedes.join(", ")}`);
      }
      return lines.length > 0 ? `${lines.join("\n")}\n` : "";
    }
    case "updated":
      return `${new Date(rec.updated_at * 1000).toISOString()}\n`;
    case "path":
      return `${rec.file_path}\n`;
  }
}

/**
 * Multi-field labeled output. Each requested field renders as a labeled
 * section, in canonical order (the order of `FIELD_ORDER`, not the order
 * flags appeared on the command line). Sections are separated by blank
 * lines to make grep-by-label reliable.
 */
function labeledFields(rec: ShowRecord, fields: FieldName[]): string {
  const parts: string[] = [];
  for (const f of fields) {
    parts.push(labeledSection(rec, f));
  }
  return parts.join("\n");
}

function labeledSection(rec: ShowRecord, field: FieldName): string {
  switch (field) {
    case "title":
      return `${DIM}title:${RST} ${rec.title ?? "—"}\n`;
    case "topics":
      return rec.topics.length > 0
        ? `${DIM}topics:${RST} ${rec.topics.join(", ")}\n`
        : `${DIM}topics:${RST} —\n`;
    case "files":
      return formatListSection(
        "files",
        rec.file_refs.map((r) => `${r.path}`),
      );
    case "links":
      return formatListSection("links", rec.wikilinks_out);
    case "backlinks":
      return formatListSection("backlinks", rec.wikilinks_in);
    case "xwiki":
      return formatListSection(
        "xwiki",
        rec.cross_wiki_links.map((x) => `${x.wiki}:${x.target}`),
      );
    case "lineage": {
      const lines: string[] = [`${DIM}lineage:${RST}`];
      if (rec.archived_at !== null) {
        lines.push(
          `  ${DIM}archived_at:${RST} ${new Date(rec.archived_at * 1000).toISOString()}`,
        );
      }
      if (rec.superseded_by !== null) {
        lines.push(`  ${DIM}superseded_by:${RST} ${rec.superseded_by}`);
      }
      if (rec.supersedes.length > 0) {
        lines.push(`  ${DIM}supersedes:${RST} ${rec.supersedes.join(", ")}`);
      }
      if (lines.length === 1) lines.push("  —");
      return lines.join("\n") + "\n";
    }
    case "updated":
      return `${DIM}updated:${RST} ${new Date(rec.updated_at * 1000).toISOString()}\n`;
    case "path":
      return `${DIM}path:${RST} ${rec.file_path}\n`;
  }
}

function formatListSection(label: string, items: string[]): string {
  if (items.length === 0) return `${DIM}${label}:${RST} —\n`;
  if (items.length <= 3) return `${DIM}${label}:${RST} ${items.join(", ")}\n`;
  return `${DIM}${label}:${RST}\n${items.map((i) => `  ${i}`).join("\n")}\n`;
}

/**
 * Metadata header rendered for default and `--meta` views. Single-line
 * fields for short lists; indented block form for long lists. This is
 * the human-readable counterpart to the JSON dump — labeled, column-
 * aligned, skimmable.
 */
function metadataHeader(rec: ShowRecord): string {
  const lines: string[] = [];
  lines.push(`${DIM}slug:${RST}       ${BLUE}${rec.slug}${RST}`);
  lines.push(`${DIM}title:${RST}      ${rec.title ?? "—"}`);
  if (rec.summary !== null && rec.summary.trim().length > 0) {
    lines.push(`${DIM}summary:${RST}    ${rec.summary.trim()}`);
  }
  lines.push(
    `${DIM}topics:${RST}     ${rec.topics.length > 0 ? rec.topics.join(", ") : "—"}`,
  );

  if (rec.file_refs.length > 0) {
    const parts = rec.file_refs.map(
      (r) => `${r.path}`,
    );
    lines.push(`${DIM}files:${RST}      ${parts.join(", ")}`);
  }

  lines.push(
    `${DIM}updated:${RST}    ${new Date(rec.updated_at * 1000).toISOString()}`,
  );

  if (rec.wikilinks_out.length > 0) {
    lines.push(`${DIM}links:${RST}      ${rec.wikilinks_out.join(", ")}`);
  }
  if (rec.wikilinks_in.length > 0) {
    lines.push(`${DIM}backlinks:${RST}  ${rec.wikilinks_in.join(", ")}`);
  }
  if (rec.cross_wiki_links.length > 0) {
    lines.push(
      `${DIM}xwiki:${RST}      ${rec.cross_wiki_links
        .map((x) => `${x.wiki}:${x.target}`)
        .join(", ")}`,
    );
  }
  if (rec.archived_at !== null) {
    lines.push(
      `${DIM}archived:${RST}   ${new Date(rec.archived_at * 1000).toISOString()}`,
    );
  }
  if (rec.superseded_by !== null) {
    lines.push(`${DIM}superseded_by:${RST} ${rec.superseded_by}`);
  }
  if (rec.supersedes.length > 0) {
    lines.push(`${DIM}supersedes:${RST} ${rec.supersedes.join(", ")}`);
  }

  return lines.join("\n");
}

// ─── Helpers ─────────────────────────────────────────────────────────

/**
 * First paragraph of the body, where "paragraph" is everything up to (but
 * not including) the first blank line. Skips a leading `# Title` line if
 * present so `--lead` previews the first real sentence, not the heading.
 */
function firstParagraph(body: string): string {
  let src = body.trimStart();
  if (src.startsWith("# ")) {
    const nl = src.indexOf("\n");
    src = nl === -1 ? "" : src.slice(nl + 1).trimStart();
  }
  const blank = src.search(/\n[ \t]*\n/);
  if (blank === -1) return src.trimEnd();
  return src.slice(0, blank).trimEnd();
}

function collectSlugs(options: ShowOptions): string[] {
  if (options.stdin === true && options.stdinInput !== undefined) {
    return options.stdinInput
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }
  if (options.slug !== undefined && options.slug.length > 0) {
    return [options.slug];
  }
  return [];
}
