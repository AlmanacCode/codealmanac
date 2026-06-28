import type { AnsiTheme } from "../../../../shared/ansi-theme.js";

import { formatTimestamp } from "./time.js";
import type { ShowRecord } from "./types.js";

export function metadataHeader(record: ShowRecord, theme: AnsiTheme): string {
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
    lines.push(
      inlineMetadata(
        "files",
        record.file_refs.map((ref) => ref.path),
        theme,
      ),
    );
  }
  if (record.sources.length > 0) {
    lines.push(
      inlineMetadata(
        "sources",
        record.sources.map(formatSource),
        theme,
      ),
    );
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
