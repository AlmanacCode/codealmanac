import { makeAnsiTheme, type AnsiTheme } from "../../../../shared/ansi-theme.js";
import type { WikiHealthReport } from "../../../../services/wiki/health.js";

export interface HealthCommandOutput {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export function renderHealthReport(
  report: WikiHealthReport,
  options: { json?: boolean; color?: boolean } = {},
): HealthCommandOutput {
  return {
    stdout: options.json === true
      ? `${JSON.stringify(report, null, 2)}\n`
      : formatReport(report, makeAnsiTheme(options.color === true)),
    stderr: migrationWarning(report),
    exitCode: 0,
  };
}

function formatReport(report: WikiHealthReport, theme: AnsiTheme): string {
  const { BLUE, DIM, RST } = theme;
  const formatSection = (
    label: string,
    count: number,
    lines: string[],
  ) => section(label, count, lines, theme);

  const sections = [
    formatSection(
      "orphans",
      report.orphans.length,
      report.orphans.map((orphan) => `  ${BLUE}${orphan.slug}${RST}`),
    ),
    formatSection(
      "stale",
      report.stale.length,
      report.stale.map(
        (stale) =>
          `  ${BLUE}${stale.slug}${RST}     ${DIM}(${stale.days_since_update} days)${RST}`,
      ),
    ),
    formatSection(
      "dead-refs",
      report.dead_refs.length,
      report.dead_refs.map(
        (deadRef) =>
          `  ${BLUE}${deadRef.slug}${RST}  references ${deadRef.path} ${DIM}(missing)${RST}`,
      ),
    ),
    formatSection(
      "broken-links",
      report.broken_links.length,
      report.broken_links.map(
        (brokenLink) =>
          `  ${BLUE}${brokenLink.source_slug}${RST} \u2192 ${brokenLink.target_slug} ${DIM}(target does not exist)${RST}`,
      ),
    ),
    formatSection(
      "broken-xwiki",
      report.broken_xwiki.length,
      report.broken_xwiki.map(
        (brokenRef) =>
          `  ${BLUE}${brokenRef.source_slug}${RST} \u2192 ${brokenRef.target_wiki}:${brokenRef.target_slug} ${DIM}(wiki unregistered or unreachable)${RST}`,
      ),
    ),
    formatSection(
      "missing-sources",
      report.missing_sources.length,
      report.missing_sources.map(
        (source) =>
          `  ${BLUE}${source.slug}${RST} cites ${source.source_id} ${DIM}(missing source)${RST}`,
      ),
    ),
    formatSection(
      "unused-sources",
      report.unused_sources.length,
      report.unused_sources.map(
        (source) =>
          `  ${BLUE}${source.slug}${RST} lists ${source.source_id} ${DIM}(not cited)${RST}`,
      ),
    ),
    formatSection(
      "legacy-frontmatter",
      report.legacy_frontmatter.length,
      report.legacy_frontmatter.map(
        (source) => `  ${BLUE}${source.slug}${RST} uses ${source.fields.join(", ")}`,
      ),
    ),
    formatSection(
      "unfixable-sources",
      report.unfixable_sources.length,
      report.unfixable_sources.map(
        (source) =>
          `  ${BLUE}${source.slug}${RST} has ambiguous legacy source ${source.source}`,
      ),
    ),
    formatSection(
      "duplicate-sources",
      report.duplicate_sources.length,
      report.duplicate_sources.map(
        (source) => `  ${BLUE}${source.slug}${RST} repeats ${source.source_id}`,
      ),
    ),
    formatSection(
      "empty-topics",
      report.empty_topics.length,
      report.empty_topics.map((topic) => `  ${BLUE}${topic.slug}${RST}`),
    ),
    formatSection(
      "empty-pages",
      report.empty_pages.length,
      report.empty_pages.map((page) => `  ${BLUE}${page.slug}${RST}`),
    ),
    formatSection(
      "slug-collisions",
      report.slug_collisions.length,
      report.slug_collisions.map(
        (collision) => `  ${BLUE}${collision.slug}${RST}: ${collision.paths.join(", ")}`,
      ),
    ),
  ];

  return `${sections.join("\n\n")}\n`;
}

function section(
  label: string,
  count: number,
  lines: string[],
  theme: AnsiTheme,
): string {
  const { BOLD, GREEN, RED, RST } = theme;

  if (count === 0) return `${BOLD}${label}${RST} ${GREEN}(0): (ok)${RST}`;
  return `${BOLD}${label}${RST} ${RED}(${count})${RST}:\n${lines.join("\n")}`;
}

function migrationWarning(report: WikiHealthReport): string {
  if (report.legacy_frontmatter.length === 0) return "";
  return "almanac: warning: legacy source frontmatter found; run `almanac migrate legacy-sources`.\n";
}
