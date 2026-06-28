import type { ShowRecord } from "./types.js";

export function bodyOnly(record: ShowRecord): string {
  if (record.body.length === 0) return "";
  return record.body.endsWith("\n") ? record.body : `${record.body}\n`;
}

export function firstParagraph(body: string): string {
  let source = body.trimStart();
  if (source.startsWith("# ")) {
    const newline = source.indexOf("\n");
    source = newline === -1 ? "" : source.slice(newline + 1).trimStart();
  }
  const blank = source.search(/\n[ \t]*\n/);
  if (blank === -1) return source.trimEnd();
  return source.slice(0, blank).trimEnd();
}
