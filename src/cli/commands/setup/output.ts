export const RST = "\x1b[0m";
export const BOLD = "\x1b[1m";
export const DIM = "\x1b[2m";
export const WHITE_BOLD = "\x1b[1;37m";
export const BLUE = "\x1b[38;5;75m";
export const BLUE_DIM = "\x1b[38;5;69m";
const ACCENT_BG = "\x1b[48;5;252m\x1b[38;5;16m";

const GRADIENT = [
  "\x1b[38;5;255m",
  "\x1b[38;5;253m",
  "\x1b[38;5;251m",
  "\x1b[38;5;249m",
  "\x1b[38;5;246m",
  "\x1b[38;5;243m",
];

const LOGO_LINES = [
  " \u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2557     \u2588\u2588\u2588\u2557   \u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2557   \u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2557  \u2588\u2588\u2588\u2588\u2588\u2588\u2557",
  "\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2551     \u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2588\u2588\u2557  \u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2550\u2550\u255d",
  "\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2551\u2588\u2588\u2551     \u2588\u2588\u2554\u2588\u2588\u2588\u2588\u2554\u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2551\u2588\u2588\u2554\u2588\u2588\u2557 \u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2551\u2588\u2588\u2551     ",
  "\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2551\u2588\u2588\u2551     \u2588\u2588\u2551\u255a\u2588\u2588\u2554\u255d\u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2551\u2588\u2588\u2551\u255a\u2588\u2588\u2557\u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2551\u2588\u2588\u2551     ",
  "\u2588\u2588\u2551  \u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2551 \u255a\u2550\u255d \u2588\u2588\u2551\u2588\u2588\u2551  \u2588\u2588\u2551\u2588\u2588\u2551 \u255a\u2588\u2588\u2588\u2588\u2551\u2588\u2588\u2551  \u2588\u2588\u2551\u255a\u2588\u2588\u2588\u2588\u2588\u2588\u2557",
  "\u255a\u2550\u255d  \u255a\u2550\u255d\u255a\u2550\u2550\u2550\u2550\u2550\u2550\u255d\u255a\u2550\u255d     \u255a\u2550\u255d\u255a\u2550\u255d  \u255a\u2550\u255d\u255a\u2550\u255d  \u255a\u2550\u2550\u2550\u255d\u255a\u2550\u255d  \u255a\u2550\u255d \u255a\u2550\u2550\u2550\u2550\u2550\u255d",
];

export const BAR = `  ${DIM}\u2502${RST}`;

export function printBanner(
  out: NodeJS.WritableStream,
  subtitle = "a living wiki for codebases, for your agent",
): void {
  out.write("\n");
  for (let i = 0; i < LOGO_LINES.length; i++) {
    const color = GRADIENT[i] ?? GRADIENT[GRADIENT.length - 1] ?? "";
    out.write(`${color}${LOGO_LINES[i]}${RST}\n`);
  }
  out.write(`\n${WHITE_BOLD}  ${subtitle}${RST}\n`);
}

export function printBadge(out: NodeJS.WritableStream): void {
  out.write(`\n   ${ACCENT_BG} almanac ${RST}\n\n`);
}

export function stepDone(out: NodeJS.WritableStream, msg: string): void {
  out.write(`  ${BLUE}\u25c7${RST}  ${msg}\n`);
}

export function stepActive(out: NodeJS.WritableStream, msg: string): void {
  out.write(`  ${BLUE}\u25c6${RST}  ${msg}\n`);
}

export function stepSkipped(out: NodeJS.WritableStream, msg: string): void {
  out.write(`  ${DIM}\u25cb  ${msg}${RST}\n`);
}

export function renderNextStepsBox(
  out: NodeJS.WritableStream,
  lines: string[],
): void {
  const header = `  ${WHITE_BOLD}Next steps${RST}`;
  const innerW = getBoxInnerWidth(out, [header, ...lines]);
  const empty = boxRow("", innerW);

  writeLine(out, `  ${BLUE_DIM}\u256d${"─".repeat(innerW)}\u256e${RST}`);
  writeLine(out, empty);
  writeLine(out, boxRow(header, innerW));
  writeLine(out, empty);
  for (const line of lines) {
    writeLine(out, boxRow(line, innerW));
  }
  writeLine(out, empty);
  writeLine(out, `  ${BLUE_DIM}\u2570${"─".repeat(innerW)}\u256f${RST}`);
  writeLine(out, "");
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

function boxRow(content: string, innerW: number): string {
  const padding = Math.max(0, innerW - visibleLength(content));
  return `  ${BLUE_DIM}\u2502${RST}${content}${" ".repeat(padding)}${BLUE_DIM}\u2502${RST}`;
}

function visibleLength(s: string): number {
  return s.replace(/\x1b\[[0-9;]*m/g, "").length;
}

function writeLine(out: NodeJS.WritableStream, line: string): void {
  out.write(`${line}\n`);
}

function getTerminalColumns(out: NodeJS.WritableStream): number {
  const stream = out as NodeJS.WriteStream;
  return stream.columns ?? process.stdout.columns ?? 80;
}
