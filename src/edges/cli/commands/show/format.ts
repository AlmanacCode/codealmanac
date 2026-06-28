import { makeAnsiTheme, type AnsiTheme } from "../../../../shared/ansi-theme.js";

import type { FieldName, ShowOptions, ShowRecord } from "./types.js";

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

export function formatShowRecords(
  records: ShowRecord[],
  options: ShowOptions,
): string {
  if (options.stdin === true) return formatBulk(records);
  if (options.json === true) return `${JSON.stringify(records[0] ?? null, null, 2)}\n`;
  const theme = makeAnsiTheme(options.color === true);
  return records.map((record) => formatRecord(record, options, theme)).join("");
}

function formatBulk(records: ShowRecord[]): string {
  if (records.length === 0) return "";
  return records.map((record) => JSON.stringify(record)).join("\n") + "\n";
}

function formatRecord(
  record: ShowRecord,
  options: ShowOptions,
  theme: AnsiTheme,
): string {
  if (options.raw === true) return bodyOnly(record);

  const fields = selectedFields(options);
  if (fields.length === 1) return bareField(record, fields[0]!);
  if (fields.length > 1) return labeledFields(record, fields, theme);

  if (options.meta === true) return metadataHeader(record, theme) + "\n";
  if (options.lead === true) return firstParagraph(record.body) + "\n";
  if (options.verbose !== true) return bodyOnly(record);

  const { DIM, RST } = theme;
  const separator = record.body.length > 0 ? `\n\n${DIM}---${RST}\n\n` : "\n";
  return metadataHeader(record, theme) + separator + record.body;
}

function selectedFields(options: ShowOptions): FieldName[] {
  return FIELD_ORDER.filter((field) => options[field] === true);
}

function bodyOnly(record: ShowRecord): string {
  if (record.body.length === 0) return "";
  return record.body.endsWith("\n") ? record.body : `${record.body}\n`;
}

function bareField(record: ShowRecord, field: FieldName): string {
  switch (field) {
    case "title":
      return (record.title ?? "") + "\n";
    case "topics":
      return record.topics.map((topic) => `${topic}\n`).join("");
    case "files":
      return record.file_refs.map((ref) => `${ref.path}\n`).join("");
    case "links":
      return record.wikilinks_out.map((target) => `${target}\n`).join("");
    case "backlinks":
      return record.wikilinks_in.map((target) => `${target}\n`).join("");
    case "xwiki":
      return record.cross_wiki_links
        .map((link) => `${link.wiki}:${link.target}\n`)
        .join("");
    case "lineage":
      return formatBareLineage(record);
    case "updated":
      return `${formatTimestamp(record.updated_at)}\n`;
    case "path":
      return `${record.file_path}\n`;
  }
}

function formatBareLineage(record: ShowRecord): string {
  const lines: string[] = [];
  if (record.archived_at !== null) {
    lines.push(`archived_at: ${formatTimestamp(record.archived_at)}`);
  }
  if (record.superseded_by !== null) {
    lines.push(`superseded_by: ${record.superseded_by}`);
  }
  if (record.supersedes.length > 0) {
    lines.push(`supersedes: ${record.supersedes.join(", ")}`);
  }
  return lines.length > 0 ? `${lines.join("\n")}\n` : "";
}

function labeledFields(
  record: ShowRecord,
  fields: FieldName[],
  theme: AnsiTheme,
): string {
  return fields.map((field) => labeledSection(record, field, theme)).join("\n");
}

function labeledSection(
  record: ShowRecord,
  field: FieldName,
  theme: AnsiTheme,
): string {
  const { DIM, RST } = theme;

  switch (field) {
    case "title":
      return `${DIM}title:${RST} ${record.title ?? "—"}\n`;
    case "topics":
      return inlineOrEmpty("topics", record.topics, theme);
    case "files":
      return formatListSection(
        "files",
        record.file_refs.map((ref) => ref.path),
        theme,
      );
    case "links":
      return formatListSection("links", record.wikilinks_out, theme);
    case "backlinks":
      return formatListSection("backlinks", record.wikilinks_in, theme);
    case "xwiki":
      return formatListSection(
        "xwiki",
        record.cross_wiki_links.map((link) => `${link.wiki}:${link.target}`),
        theme,
      );
    case "lineage":
      return formatLabeledLineage(record, theme);
    case "updated":
      return `${DIM}updated:${RST} ${formatTimestamp(record.updated_at)}\n`;
    case "path":
      return `${DIM}path:${RST} ${record.file_path}\n`;
  }
}

function inlineOrEmpty(
  label: string,
  items: string[],
  theme: AnsiTheme,
): string {
  const { DIM, RST } = theme;
  return items.length > 0
    ? `${DIM}${label}:${RST} ${items.join(", ")}\n`
    : `${DIM}${label}:${RST} —\n`;
}

function formatListSection(
  label: string,
  items: string[],
  theme: AnsiTheme,
): string {
  const { DIM, RST } = theme;
  if (items.length === 0) return `${DIM}${label}:${RST} —\n`;
  if (items.length <= 3) return `${DIM}${label}:${RST} ${items.join(", ")}\n`;
  return `${DIM}${label}:${RST}\n${items.map((item) => `  ${item}`).join("\n")}\n`;
}

function formatLabeledLineage(
  record: ShowRecord,
  theme: AnsiTheme,
): string {
  const { DIM, RST } = theme;
  const lines: string[] = [`${DIM}lineage:${RST}`];
  if (record.archived_at !== null) {
    lines.push(`  ${DIM}archived_at:${RST} ${formatTimestamp(record.archived_at)}`);
  }
  if (record.superseded_by !== null) {
    lines.push(`  ${DIM}superseded_by:${RST} ${record.superseded_by}`);
  }
  if (record.supersedes.length > 0) {
    lines.push(`  ${DIM}supersedes:${RST} ${record.supersedes.join(", ")}`);
  }
  if (lines.length === 1) lines.push("  —");
  return lines.join("\n") + "\n";
}

function metadataHeader(record: ShowRecord, theme: AnsiTheme): string {
  const { BLUE, DIM, RST } = theme;
  const lines = [
    `${DIM}slug:${RST}       ${BLUE}${record.slug}${RST}`,
    `${DIM}title:${RST}      ${record.title ?? "—"}`,
  ];

  if (record.summary !== null && record.summary.trim().length > 0) {
    lines.push(`${DIM}summary:${RST}    ${record.summary.trim()}`);
  }

  lines.push(inlineMetadata("topics", record.topics, theme));
  if (record.file_refs.length > 0) {
    lines.push(inlineMetadata(
      "files",
      record.file_refs.map((ref) => ref.path),
      theme,
    ));
  }
  if (record.sources.length > 0) {
    lines.push(inlineMetadata(
      "sources",
      record.sources.map(formatSource),
      theme,
    ));
  }

  lines.push(`${DIM}updated:${RST}    ${formatTimestamp(record.updated_at)}`);
  appendOptionalMetadata(lines, record, theme);
  return lines.join("\n");
}

function inlineMetadata(
  label: string,
  items: string[],
  theme: AnsiTheme,
): string {
  const { DIM, RST } = theme;
  return `${DIM}${label}:${RST}     ${items.length > 0 ? items.join(", ") : "—"}`;
}

function formatSource(source: ShowRecord["sources"][number]): string {
  if (source.type === "file") return `${source.id} (file: ${source.target})`;
  return `${source.id} (${source.type})`;
}

function appendOptionalMetadata(
  lines: string[],
  record: ShowRecord,
  theme: AnsiTheme,
): void {
  const { DIM, RST } = theme;

  if (record.wikilinks_out.length > 0) {
    lines.push(`${DIM}links:${RST}      ${record.wikilinks_out.join(", ")}`);
  }
  if (record.wikilinks_in.length > 0) {
    lines.push(`${DIM}backlinks:${RST}  ${record.wikilinks_in.join(", ")}`);
  }
  if (record.cross_wiki_links.length > 0) {
    const links = record.cross_wiki_links
      .map((link) => `${link.wiki}:${link.target}`)
      .join(", ");
    lines.push(`${DIM}xwiki:${RST}      ${links}`);
  }
  if (record.archived_at !== null) {
    lines.push(`${DIM}archived:${RST}   ${formatTimestamp(record.archived_at)}`);
  }
  if (record.superseded_by !== null) {
    lines.push(`${DIM}superseded_by:${RST} ${record.superseded_by}`);
  }
  if (record.supersedes.length > 0) {
    lines.push(`${DIM}supersedes:${RST} ${record.supersedes.join(", ")}`);
  }
}

function firstParagraph(body: string): string {
  let source = body.trimStart();
  if (source.startsWith("# ")) {
    const newline = source.indexOf("\n");
    source = newline === -1 ? "" : source.slice(newline + 1).trimStart();
  }
  const blank = source.search(/\n[ \t]*\n/);
  if (blank === -1) return source.trimEnd();
  return source.slice(0, blank).trimEnd();
}

function formatTimestamp(epochSeconds: number): string {
  return new Date(epochSeconds * 1000).toISOString();
}
