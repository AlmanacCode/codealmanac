import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

import { BLUE, BOLD, DIM, RST, renderNextStepsBox } from "./output.js";

/**
 * Print the "Next steps" box. When `existingPageCount` is greater than 0,
 * the current working directory already has a wiki with committed pages.
 * In that case we skip the `almanac init` step and tell the user to
 * start querying.
 */
export function printNextSteps(
  out: NodeJS.WritableStream,
  existingPageCount: number,
  mode: "hosted" | "hosted-cloud" | "self-managed" = "hosted",
): void {
  if (mode === "self-managed") {
    renderNextStepsBox(out, [
      `  ${BLUE}1.${RST}  Local automations are running:`,
      `       ${BOLD}almanac sync --quiet 45m${RST}`,
      `       ${BOLD}almanac garden${RST}`,
      `  ${BLUE}2.${RST}  Query locally:`,
      `       ${BOLD}almanac search "auth"${RST}`,
      `       ${BOLD}almanac search --mentions <file>${RST}`,
    ]);
    return;
  } else if (mode === "hosted-cloud") {
    renderNextStepsBox(out, [
      `  ${BLUE}1.${RST}  Check hosted capture:`,
      `       ${BOLD}almanac cloud status${RST}`,
      `  ${BLUE}2.${RST}  Query locally after .almanac updates land:`,
      `       ${BOLD}almanac search "auth"${RST}`,
      `       ${BOLD}almanac search --mentions <file>${RST}`,
    ]);
    return;
  } else if (existingPageCount > 0) {
    renderNextStepsBox(out, [
      `  ${BLUE}\u25c7${RST}  This repo already has a wiki ${DIM}(${existingPageCount} page${existingPageCount === 1 ? "" : "s"})${RST}`,
      "",
      `  ${BLUE}1.${RST}  Start querying it locally:`,
      `       ${BOLD}almanac search --mentions <file>${RST}`,
      `       ${BOLD}almanac search "auth"${RST}`,
      `  ${BLUE}2.${RST}  Read one of the result pages:`,
      `       ${BOLD}almanac show <result-slug>${RST}`,
    ]);
    return;
  }

  renderNextStepsBox(out, [
    `  ${BLUE}1.${RST}  Create this repo's wiki from the dashboard:`,
    `       ${BOLD}https://codealmanac.com/dashboard${RST}`,
    `  ${BLUE}2.${RST}  After .almanac/ lands, query locally:`,
    `       ${BOLD}almanac search "auth"${RST}`,
  ]);
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
