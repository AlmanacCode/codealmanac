import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

const RST = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const WHITE_BOLD = "\x1b[1;37m";
const BLUE = "\x1b[38;5;75m";
const BLUE_DIM = "\x1b[38;5;69m";

/**
 * Print the "Next steps" box. When `existingPageCount` is greater than 0,
 * the current working directory already has a wiki with committed pages.
 * In that case we skip the `almanac init` step and tell the user to
 * start querying.
 */
export function printNextSteps(
  out: NodeJS.WritableStream,
  existingPageCount: number,
): void {
  const innerW = 62;
  const vis = (s: string): number =>
    s.replace(/\x1b\[[0-9;]*m/g, "").length;
  const row = (content: string): string => {
    const padding = Math.max(0, innerW - vis(content));
    return `  ${BLUE_DIM}\u2502${RST}${content}${" ".repeat(padding)}${BLUE_DIM}\u2502${RST}\n`;
  };
  const empty = row("");

  out.write(`  ${BLUE_DIM}\u256d${"─".repeat(innerW)}\u256e${RST}\n`);
  out.write(empty);
  out.write(row(`  ${WHITE_BOLD}Next steps${RST}`));
  out.write(empty);

  if (existingPageCount > 0) {
    out.write(
      row(
        `  ${BLUE}\u25c7${RST}  This repo already has a wiki ${DIM}(${existingPageCount} page${existingPageCount === 1 ? "" : "s"})${RST}`,
      ),
    );
    out.write(empty);
    out.write(row(`  ${BLUE}1.${RST}  Start querying your wiki:`));
    out.write(row(`       ${BOLD}almanac search --mentions <file>${RST}`));
    out.write(
      row(`  ${BLUE}2.${RST}  Work normally — capture runs on session end`),
    );
  } else {
    out.write(
      row(`  ${BLUE}1.${RST}  ${BOLD}cd${RST} into a repo you want to document`),
    );
    out.write(
      row(
        `  ${BLUE}2.${RST}  ${BOLD}almanac init${RST}  ${DIM}# build the wiki${RST}`,
      ),
    );
    out.write(
      row(`  ${BLUE}3.${RST}  Work normally — capture runs on session end`),
    );
  }

  out.write(empty);
  out.write(`  ${BLUE_DIM}\u2570${"─".repeat(innerW)}\u256f${RST}\n\n`);
}

/**
 * Count `.md` files in `.almanac/pages/` under the current working
 * directory or any parent. Returns 0 when no wiki is found or the pages
 * directory is empty.
 */
export function countExistingPages(cwd: string): number {
  try {
    let dir = cwd;
    for (let i = 0; i < 10; i++) {
      const pagesDir = path.join(dir, ".almanac", "pages");
      if (existsSync(pagesDir)) {
        try {
          const entries = readdirSync(pagesDir);
          return entries.filter((e) => e.endsWith(".md")).length;
        } catch {
          return 0;
        }
      }
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  } catch {
    // Swallow — never crash setup because of this.
  }
  return 0;
}
