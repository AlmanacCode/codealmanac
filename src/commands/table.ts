export interface TextTable {
  headers: string[];
  rows: string[][];
}

const ANSI_RE = /\x1b\[[0-9;]*m/g;

export function formatTextTable(table: TextTable): string[] {
  if (table.headers.length === 0) return [];
  const widths = table.headers.map((header, index) =>
    Math.max(
      visibleLength(header),
      ...table.rows.map((row) => visibleLength(row[index] ?? "")),
    ),
  );
  return [
    formatTableRow(table.headers, widths),
    ...table.rows.map((row) => formatTableRow(row, widths)),
  ];
}

function formatTableRow(row: string[], widths: number[]): string {
  return widths
    .map((width, index) => padVisible(row[index] ?? "", width))
    .join("  ")
    .trimEnd();
}

function padVisible(value: string, width: number): string {
  return `${value}${" ".repeat(Math.max(0, width - visibleLength(value)))}`;
}

function visibleLength(value: string): number {
  return value.replace(ANSI_RE, "").length;
}
