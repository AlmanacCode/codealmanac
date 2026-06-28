import { makeAnsiTheme } from "../../../ansi-theme.js";

export interface SetupTheme {
  RST: string;
  BOLD: string;
  DIM: string;
  WHITE_BOLD: string;
  BLUE: string;
  BLUE_DIM: string;
  ACCENT_BG: string;
  LOGO_GRADIENT: readonly string[];
}

const SETUP_LOGO_GRADIENT = [
  "\x1b[38;5;255m",
  "\x1b[38;5;253m",
  "\x1b[38;5;251m",
  "\x1b[38;5;249m",
  "\x1b[38;5;246m",
  "\x1b[38;5;243m",
];

const PLAIN_LOGO_GRADIENT = SETUP_LOGO_GRADIENT.map(() => "");

const LOGO_LINES = [
  " \u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2557     \u2588\u2588\u2588\u2557   \u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2557   \u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2557  \u2588\u2588\u2588\u2588\u2588\u2588\u2557",
  "\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2551     \u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2588\u2588\u2557  \u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2550\u2550\u255d",
  "\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2551\u2588\u2588\u2551     \u2588\u2588\u2554\u2588\u2588\u2588\u2588\u2554\u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2551\u2588\u2588\u2554\u2588\u2588\u2557 \u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2551\u2588\u2588\u2551     ",
  "\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2551\u2588\u2588\u2551     \u2588\u2588\u2551\u255a\u2588\u2588\u2554\u255d\u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2551\u2588\u2588\u2551\u255a\u2588\u2588\u2557\u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2551\u2588\u2588\u2551     ",
  "\u2588\u2588\u2551  \u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2551 \u255a\u2550\u255d \u2588\u2588\u2551\u2588\u2588\u2551  \u2588\u2588\u2551\u2588\u2588\u2551 \u255a\u2588\u2588\u2588\u2588\u2551\u2588\u2588\u2551  \u2588\u2588\u2551\u255a\u2588\u2588\u2588\u2588\u2588\u2588\u2557",
  "\u255a\u2550\u255d  \u255a\u2550\u255d\u255a\u2550\u2550\u2550\u2550\u2550\u2550\u255d\u255a\u2550\u255d     \u255a\u2550\u255d\u255a\u2550\u255d  \u255a\u2550\u255d\u255a\u2550\u255d  \u255a\u2550\u2550\u2550\u255d\u255a\u2550\u255d  \u255a\u2550\u255d \u255a\u2550\u2550\u2550\u2550\u2550\u255d",
];

export function makeSetupTheme(useColor: boolean): SetupTheme {
  const theme = makeAnsiTheme(useColor);
  return {
    RST: theme.RST,
    BOLD: theme.BOLD,
    DIM: theme.DIM,
    WHITE_BOLD: theme.WHITE_BOLD,
    BLUE: theme.BLUE,
    BLUE_DIM: theme.BLUE_DIM,
    ACCENT_BG: theme.ACCENT_BG,
    LOGO_GRADIENT: useColor ? SETUP_LOGO_GRADIENT : PLAIN_LOGO_GRADIENT,
  };
}

export function blue(theme: SetupTheme, text: string): string {
  return `${theme.BLUE}${text}${theme.RST}`;
}

export function bold(theme: SetupTheme, text: string): string {
  return `${theme.BOLD}${text}${theme.RST}`;
}

export function dim(theme: SetupTheme, text: string): string {
  return `${theme.DIM}${text}${theme.RST}`;
}

export function whiteBold(theme: SetupTheme, text: string): string {
  return `${theme.WHITE_BOLD}${text}${theme.RST}`;
}

export function controlLabel(theme: SetupTheme, text: string): string {
  return `${theme.BLUE}${theme.BOLD}${text}${theme.RST}`;
}

export function printBanner(
  out: NodeJS.WritableStream,
  theme: SetupTheme,
  subtitle = "a living wiki for codebases, for your agent",
): void {
  out.write("\n");
  for (let i = 0; i < LOGO_LINES.length; i++) {
    const color = theme.LOGO_GRADIENT[i] ?? "";
    out.write(`${color}${LOGO_LINES[i]}${theme.RST}\n`);
  }
  out.write(`\n${theme.WHITE_BOLD}  ${subtitle}${theme.RST}\n`);
}

export function printBadge(
  out: NodeJS.WritableStream,
  theme: SetupTheme,
): void {
  out.write(`\n   ${theme.ACCENT_BG} almanac ${theme.RST}\n\n`);
}

export function stepDone(
  out: NodeJS.WritableStream,
  theme: SetupTheme,
  msg: string,
): void {
  out.write(`  ${theme.BLUE}\u25c7${theme.RST}  ${msg}\n`);
}

export function stepActive(
  out: NodeJS.WritableStream,
  theme: SetupTheme,
  msg: string,
): void {
  out.write(`  ${theme.BLUE}\u25c6${theme.RST}  ${msg}\n`);
}

export function stepSkipped(
  out: NodeJS.WritableStream,
  theme: SetupTheme,
  msg: string,
): void {
  out.write(`  ${theme.DIM}\u25cb  ${msg}${theme.RST}\n`);
}

export function writeSetupDivider(
  out: NodeJS.WritableStream,
  theme: SetupTheme,
): void {
  out.write(`${setupDivider(theme)}\n`);
}

export function renderNextStepsBox(
  out: NodeJS.WritableStream,
  theme: SetupTheme,
  lines: string[],
): void {
  const header = `  ${theme.WHITE_BOLD}Next steps${theme.RST}`;
  const innerW = getBoxInnerWidth(out, [header, ...lines]);
  const empty = boxRow(theme, "", innerW);

  writeLine(
    out,
    `  ${theme.BLUE_DIM}\u256d${"─".repeat(innerW)}\u256e${theme.RST}`,
  );
  writeLine(out, empty);
  writeLine(out, boxRow(theme, header, innerW));
  writeLine(out, empty);
  for (const line of lines) {
    writeLine(out, boxRow(theme, line, innerW));
  }
  writeLine(out, empty);
  writeLine(
    out,
    `  ${theme.BLUE_DIM}\u2570${"─".repeat(innerW)}\u256f${theme.RST}`,
  );
  writeLine(out, "");
}

function setupDivider(theme: SetupTheme): string {
  return `  ${theme.DIM}\u2502${theme.RST}`;
}

function getBoxInnerWidth(
  out: NodeJS.WritableStream,
  contents: string[],
  minWidth = 62,
): number {
  const terminalWidth = getTerminalColumns(out);
  const available = Math.max(40, terminalWidth - 6);
  const widest = contents.reduce(
    (max, content) => Math.max(max, visibleLength(content)),
    0,
  );
  return Math.min(Math.max(minWidth, widest), available);
}

function boxRow(theme: SetupTheme, content: string, innerW: number): string {
  const padding = Math.max(0, innerW - visibleLength(content));
  return (
    `  ${theme.BLUE_DIM}\u2502${theme.RST}` +
    `${content}${" ".repeat(padding)}` +
    `${theme.BLUE_DIM}\u2502${theme.RST}`
  );
}

function visibleLength(s: string): number {
  return s.replace(/\x1b\[[0-9;]*m/g, "").length;
}

function writeLine(out: NodeJS.WritableStream, line: string): void {
  out.write(`${line}\n`);
}

function getTerminalColumns(out: NodeJS.WritableStream): number {
  const stream = out as NodeJS.WriteStream;
  return stream.columns ?? 80;
}
