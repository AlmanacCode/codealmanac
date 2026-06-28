import { makeAnsiTheme, type AnsiTheme } from "../../../../shared/ansi-theme.js";

import { bodyOnly, firstParagraph } from "./body.js";
import {
  formatBareField,
  formatLabeledFields,
  selectedFields,
} from "./fields.js";
import { metadataHeader } from "./metadata.js";
import type { ShowOptions, ShowRecord } from "./types.js";

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
  if (fields.length === 1) return formatBareField(record, fields[0]!);
  if (fields.length > 1) return formatLabeledFields(record, fields, theme);

  if (options.meta === true) return metadataHeader(record, theme) + "\n";
  if (options.lead === true) return firstParagraph(record.body) + "\n";
  if (options.verbose !== true) return bodyOnly(record);

  const { DIM, RST } = theme;
  const separator = record.body.length > 0 ? `\n\n${DIM}---${RST}\n\n` : "\n";
  return metadataHeader(record, theme) + separator + record.body;
}
