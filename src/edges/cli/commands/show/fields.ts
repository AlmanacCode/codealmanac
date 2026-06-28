import type { AnsiTheme } from "../../../../shared/ansi-theme.js";

import { formatTimestamp } from "./time.js";
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

export function selectedFields(options: ShowOptions): FieldName[] {
  return FIELD_ORDER.filter((field) => options[field] === true);
}

export function formatBareField(
  record: ShowRecord,
  field: FieldName,
): string {
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

export function formatLabeledFields(
  record: ShowRecord,
  fields: FieldName[],
  theme: AnsiTheme,
): string {
  return fields.map((field) => labeledSection(record, field, theme)).join("\n");
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
    lines.push(
      `  ${DIM}archived_at:${RST} ${formatTimestamp(record.archived_at)}`,
    );
  }
  if (record.superseded_by !== null) {
    lines.push(`  ${DIM}superseded_by:${RST} ${record.superseded_by}`);
  }
  if (record.supersedes.length > 0) {
    lines.push(`  ${DIM}supersedes:${RST} ${record.supersedes.join(", ")}`);
  }
  if (lines.length === 1) lines.push("  —");
  return `${lines.join("\n")}\n`;
}
