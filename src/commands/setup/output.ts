export const RST = "\x1b[0m";
export const DIM = "\x1b[2m";
export const WHITE_BOLD = "\x1b[1;37m";
export const BLUE = "\x1b[38;5;75m";
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
  "    _    _     __  __    _    _   _    _     ____ ",
  "   / \\  | |   |  \\/  |  / \\  | \\ | |  / \\   / ___|",
  "  / _ \\ | |   | |\\/| | / _ \\ |  \\| | / _ \\ | |    ",
  " / ___ \\| |___| |  | |/ ___ \\| |\\  |/ ___ \\| |___ ",
  "/_/   \\_\\_____|_|  |_/_/   \\_\\_| \\_/_/   \\_\\\\____|",
  "       a living wiki for codebases, for your agent  ",
];

export const BAR = `  ${DIM}\u2502${RST}`;

export function printBanner(out: NodeJS.WritableStream): void {
  out.write("\n");
  for (let i = 0; i < LOGO_LINES.length; i++) {
    const color = GRADIENT[Math.min(i, GRADIENT.length - 1)] ?? "";
    out.write(`${color}${LOGO_LINES[i]}${RST}\n`);
  }
  out.write(`\n${WHITE_BOLD}  Set up your automatic codebase wiki${RST}\n`);
}

export function printBadge(out: NodeJS.WritableStream): void {
  out.write(`\n   ${ACCENT_BG} Almanac ${RST}\n\n`);
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

export type InstallDecision = "install" | "skip";

export function confirm(
  out: NodeJS.WritableStream,
  question: string,
  defaultYes: boolean,
): Promise<InstallDecision> {
  return new Promise((resolve) => {
    const hint = defaultYes ? "[Y/n]" : "[y/N]";
    out.write(`  ${BLUE}\u25c6${RST}  ${question} ${DIM}${hint}${RST} `);

    let buf = "";
    const onData = (chunk: Buffer): void => {
      buf += chunk.toString("utf8");
      const nl = buf.indexOf("\n");
      if (nl === -1) return;
      process.stdin.removeListener("data", onData);
      process.stdin.pause();

      const answer = buf.slice(0, nl).trim().toLowerCase();
      const accepted =
        answer.length === 0
          ? defaultYes
          : answer === "y" || answer === "yes";
      resolve(accepted ? "install" : "skip");
    };

    process.stdin.resume();
    process.stdin.on("data", onData);
  });
}

export function promptText(
  out: NodeJS.WritableStream,
  question: string,
  defaultValue: string,
): Promise<string> {
  return new Promise((resolve) => {
    out.write(
      `  ${BLUE}\u25c6${RST}  ${question} ${DIM}[${defaultValue}]${RST} `,
    );

    let buf = "";
    const onData = (chunk: Buffer): void => {
      buf += chunk.toString("utf8");
      const nl = buf.indexOf("\n");
      if (nl === -1) return;
      process.stdin.removeListener("data", onData);
      process.stdin.pause();

      const answer = buf.slice(0, nl).trim();
      resolve(answer.length === 0 ? defaultValue : answer);
    };

    process.stdin.resume();
    process.stdin.on("data", onData);
  });
}

export async function waitForEnter(
  out: NodeJS.WritableStream,
  message: string,
): Promise<void> {
  await promptText(out, message, "");
}

export interface SelectChoice<T> {
  value: T;
  line: string;
  aliases?: string[];
}

export async function selectChoice<T>(args: {
  out: NodeJS.WritableStream;
  title: string;
  help?: string;
  choices: SelectChoice<T>[];
  defaultIndex: number;
}): Promise<T> {
  const selected = clampIndex(args.defaultIndex, args.choices.length);
  if (canUseRawSelect()) {
    return await selectChoiceRaw({ ...args, defaultIndex: selected });
  }
  renderSelect(args.out, {
    title: args.title,
    help: args.help,
    choices: args.choices,
    selected,
    raw: false,
  });
  const answer = await promptText(args.out, "Select", String(selected + 1));
  const index = Number.parseInt(answer, 10);
  if (
    Number.isInteger(index) &&
    index >= 1 &&
    index <= args.choices.length
  ) {
    return args.choices[index - 1]!.value;
  }
  const normalized = answer.trim().toLowerCase();
  const matched = args.choices.find((choice) =>
    choice.aliases?.some((alias) => alias.toLowerCase() === normalized)
  );
  return (matched ?? args.choices[selected])!.value;
}

async function selectChoiceRaw<T>(args: {
  out: NodeJS.WritableStream;
  title: string;
  help?: string;
  choices: SelectChoice<T>[];
  defaultIndex: number;
}): Promise<T> {
  return new Promise((resolve, reject) => {
    let selected = args.defaultIndex;
    let renderedLines = 0;
    const input = process.stdin as NodeJS.ReadStream & {
      setRawMode?: (mode: boolean) => void;
    };
    const render = (): void => {
      if (renderedLines > 0) {
        args.out.write(`\x1b[${renderedLines}A\x1b[0J`);
      }
      renderedLines = renderSelect(args.out, {
        title: args.title,
        help: args.help,
        choices: args.choices,
        selected,
        raw: true,
      });
    };
    const cleanup = (): void => {
      input.removeListener("data", onData);
      input.setRawMode?.(false);
      input.pause();
    };
    const onData = (chunk: Buffer): void => {
      const key = chunk.toString("utf8");
      if (key === "\u0003") {
        cleanup();
        args.out.write("\n");
        reject(new SetupInterruptedError());
        return;
      }
      if (key === "\r" || key === "\n") {
        cleanup();
        args.out.write("\n");
        resolve(args.choices[selected]!.value);
        return;
      }
      if (key === "\u001b[A") {
        selected = selected === 0 ? args.choices.length - 1 : selected - 1;
        render();
      } else if (key === "\u001b[B") {
        selected = selected === args.choices.length - 1 ? 0 : selected + 1;
        render();
      }
    };
    input.setRawMode?.(true);
    input.resume();
    input.on("data", onData);
    render();
  });
}

function renderSelect<T>(
  out: NodeJS.WritableStream,
  args: {
    title: string;
    help?: string;
    choices: SelectChoice<T>[];
    selected: number;
    raw: boolean;
  },
): number {
  let lines = 0;
  out.write(`  ${WHITE_BOLD}${args.title}${RST}\n`);
  lines++;
  if (args.help !== undefined) {
    out.write(`  ${DIM}${args.help}${RST}\n`);
    lines++;
  }
  out.write("\n");
  lines++;
  args.choices.forEach((choice, index) => {
    const pointer = index === args.selected ? `${BLUE}\u203a${RST}` : " ";
    out.write(`  ${pointer} ${choice.line}\n`);
    lines++;
  });
  const hint = args.raw
    ? `Use \u2191/\u2193 to move, Enter to select`
    : `Type a number or name, then press Enter`;
  out.write(`\n  ${DIM}${hint}${RST}\n`);
  lines += 2;
  return lines;
}

class SetupInterruptedError extends Error {
  constructor() {
    super("setup interrupted");
  }
}

export function isSetupInterrupted(err: unknown): boolean {
  return err instanceof SetupInterruptedError;
}

function canUseRawSelect(): boolean {
  const input = process.stdin as NodeJS.ReadStream & {
    setRawMode?: (mode: boolean) => void;
  };
  return process.stdin.isTTY === true && typeof input.setRawMode === "function";
}

function clampIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  if (index < 0) return 0;
  if (index >= length) return length - 1;
  return index;
}
