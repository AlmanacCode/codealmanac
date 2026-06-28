import { makeAnsiTheme, type AnsiTheme } from "../../../../shared/ansi-theme.js";
import type {
  WikiTopicRecord,
  WikiTopicResult,
  WikiTopicSummary,
} from "../../../../services/wiki/topics.js";
import { formatTextTable } from "../table.js";
import type { TopicsCommandOutput } from "./types.js";

interface TopicsReadRenderOptions {
  json?: boolean;
  color?: boolean;
}

export function renderTopicsList(
  rows: WikiTopicSummary[],
  options: TopicsReadRenderOptions = {},
): TopicsCommandOutput {
  if (options.json === true) return ok(`${JSON.stringify(rows, null, 2)}\n`);

  if (rows.length === 0) {
    return ok(
      "no topics. create one with `almanac topics create <name>` or tag a page.\n",
    );
  }

  const theme = makeAnsiTheme(options.color === true);
  const lines = formatTextTable({
    headers: ["TOPIC", "PAGES"],
    rows: rows.map((row) => [
      `${theme.BLUE}${row.slug}${theme.RST}`,
      `${theme.DIM}${formatPageCount(row.page_count)}${theme.RST}`,
    ]),
  });
  return ok(`${lines.join("\n")}\n`);
}

export function renderTopicsShow(
  result: WikiTopicResult,
  options: TopicsReadRenderOptions = {},
): TopicsCommandOutput {
  switch (result.status) {
    case "found":
      return ok(
        options.json === true
          ? `${JSON.stringify(result.topic, null, 2)}\n`
          : formatTopicRecord(
              result.topic,
              makeAnsiTheme(options.color === true),
            ),
      );
    case "empty-slug":
      return error("almanac: empty topic slug\n");
    case "missing":
      return error(`almanac: no such topic "${result.slug}"\n`);
  }
}

function formatTopicRecord(record: WikiTopicRecord, theme: AnsiTheme): string {
  const lines: string[] = [];
  lines.push(
    `${theme.DIM}slug:${theme.RST}         ${theme.BLUE}${record.slug}${theme.RST}`,
  );
  lines.push(`${theme.DIM}title:${theme.RST}        ${record.title}`);
  lines.push(
    `${theme.DIM}description:${theme.RST}  ${record.description ?? "—"}`,
  );
  lines.push(
    `${theme.DIM}parents:${theme.RST}      ${formatTopicList(record.parents)}`,
  );
  lines.push(
    `${theme.DIM}children:${theme.RST}     ${formatTopicList(record.children)}`,
  );
  const pagesLabel = record.descendants_used === true
    ? "pages (incl. descendants)"
    : "pages";
  lines.push(`${theme.DIM}${pagesLabel}:${theme.RST}`);
  if (record.pages.length === 0) {
    lines.push("  —");
  } else {
    for (const page of record.pages) {
      lines.push(`  ${theme.BLUE}${page}${theme.RST}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

function formatTopicList(slugs: string[]): string {
  return slugs.length > 0 ? slugs.join(", ") : "—";
}

function formatPageCount(pageCount: number): string {
  return `(${pageCount} page${pageCount === 1 ? "" : "s"})`;
}

function ok(stdout: string): TopicsCommandOutput {
  return { stdout, stderr: "", exitCode: 0 };
}

function error(stderr: string): TopicsCommandOutput {
  return { stdout: "", stderr, exitCode: 1 };
}
