import { makeAnsiTheme, type AnsiTheme } from "../../../shared/ansi-theme.js";
import type { RegisteredWiki } from "../../../services/wiki/registry.js";

export interface ListCommandOutput {
  stdout: string;
  exitCode: number;
}

export function renderListWikis(
  entries: RegisteredWiki[],
  options: { json?: boolean; verbose?: boolean; color?: boolean } = {},
): ListCommandOutput {
  if (options.json === true) {
    return { stdout: `${JSON.stringify(entries, null, 2)}\n`, exitCode: 0 };
  }

  return {
    stdout: options.verbose === true
      ? formatPretty(entries, makeAnsiTheme(options.color === true))
      : formatNames(entries),
    exitCode: 0,
  };
}

export function renderListDropResult(
  name: string,
  removed: RegisteredWiki | null,
): ListCommandOutput {
  if (removed === null) {
    return {
      stdout: `no registry entry named "${name}"\n`,
      exitCode: 1,
    };
  }

  return {
    stdout: `removed "${removed.name}" (${removed.path})\n`,
    exitCode: 0,
  };
}

/**
 * Human-readable listing. Empty state gets a hint, while default list output
 * stays blank so scripts can treat stdout as rows only.
 */
function formatPretty(entries: RegisteredWiki[], theme: AnsiTheme): string {
  const { BLUE, BOLD, DIM, RST } = theme;

  if (entries.length === 0) {
    return `${DIM}no wikis registered. run \`almanac init\` in a repo to create one.${RST}\n`;
  }

  const nameWidth = Math.min(
    30,
    entries.reduce((width, entry) => Math.max(width, entry.name.length), 0),
  );

  const lines: string[] = [];
  for (const entry of entries) {
    const name = entry.name.padEnd(nameWidth);
    const description = entry.description.length > 0 ? entry.description : "—";
    lines.push(`${BLUE}${BOLD}${name}${RST}  ${description}`);
    lines.push(`${" ".repeat(nameWidth)}  ${DIM}${entry.path}${RST}`);
  }
  return `${lines.join("\n")}\n`;
}

function formatNames(entries: RegisteredWiki[]): string {
  if (entries.length === 0) return "";
  return `${entries.map((entry) => entry.name).join("\n")}\n`;
}
