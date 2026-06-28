import {
  blue,
  dim,
  type SetupTheme,
  whiteBold,
} from "./output.js";
import type { SetupInputStream } from "./types.js";

export type InstallDecision = "install" | "skip";

export function confirm(
  input: SetupInputStream,
  out: NodeJS.WritableStream,
  theme: SetupTheme,
  question: string,
  defaultYes: boolean,
): Promise<InstallDecision> {
  return new Promise((resolve) => {
    const hint = defaultYes ? "[Y/n]" : "[y/N]";
    out.write(
      `  ${blue(theme, "◆")}  ${question} ${dim(theme, hint)} `,
    );

    let buf = "";
    const onData = (chunk: Buffer): void => {
      buf += chunk.toString("utf8");
      const nl = buf.indexOf("\n");
      if (nl === -1) return;
      input.removeListener("data", onData);
      input.pause();

      const answer = buf.slice(0, nl).trim().toLowerCase();
      const accepted =
        answer.length === 0
          ? defaultYes
          : answer === "y" || answer === "yes";
      resolve(accepted ? "install" : "skip");
    };

    input.resume();
    input.on("data", onData);
  });
}

export function promptText(
  input: SetupInputStream,
  out: NodeJS.WritableStream,
  theme: SetupTheme,
  question: string,
  defaultValue: string,
): Promise<string> {
  return new Promise((resolve) => {
    out.write(
      `  ${blue(theme, "◆")}  ${question} ${dim(theme, `[${defaultValue}]`)} `,
    );

    let buf = "";
    const onData = (chunk: Buffer): void => {
      buf += chunk.toString("utf8");
      const nl = buf.indexOf("\n");
      if (nl === -1) return;
      input.removeListener("data", onData);
      input.pause();

      const answer = buf.slice(0, nl).trim();
      resolve(answer.length === 0 ? defaultValue : answer);
    };

    input.resume();
    input.on("data", onData);
  });
}

export async function waitForEnter(
  input: SetupInputStream,
  out: NodeJS.WritableStream,
  theme: SetupTheme,
  message: string,
): Promise<void> {
  await promptText(input, out, theme, message, "");
}

export interface SelectChoice<T> {
  value: T;
  line: string;
  aliases?: string[];
}

export async function selectChoice<T>(args: {
  input: SetupInputStream;
  out: NodeJS.WritableStream;
  theme: SetupTheme;
  title: string;
  help?: string;
  choices: SelectChoice<T>[];
  defaultIndex: number;
}): Promise<T> {
  const selected = clampIndex(args.defaultIndex, args.choices.length);
  if (canUseRawSelect(args.input)) {
    return await selectChoiceRaw({ ...args, defaultIndex: selected });
  }
  renderSelect(args.out, args.theme, {
    title: args.title,
    help: args.help,
    choices: args.choices,
    selected,
    raw: false,
  });
  const answer = await promptText(
    args.input,
    args.out,
    args.theme,
    "Select",
    String(selected + 1),
  );
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
  input: SetupInputStream;
  out: NodeJS.WritableStream;
  theme: SetupTheme;
  title: string;
  help?: string;
  choices: SelectChoice<T>[];
  defaultIndex: number;
}): Promise<T> {
  return new Promise((resolve, reject) => {
    let selected = args.defaultIndex;
    let renderedLines = 0;
    const input = args.input;
    const render = (): void => {
      if (renderedLines > 0) {
        args.out.write(`\x1b[${renderedLines}A\x1b[0J`);
      }
      renderedLines = renderSelect(args.out, args.theme, {
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
  theme: SetupTheme,
  args: {
    title: string;
    help?: string;
    choices: SelectChoice<T>[];
    selected: number;
    raw: boolean;
  },
): number {
  let lines = 0;
  out.write(`  ${whiteBold(theme, args.title)}\n`);
  lines++;
  if (args.help !== undefined) {
    out.write(`  ${dim(theme, args.help)}\n`);
    lines++;
  }
  out.write("\n");
  lines++;
  args.choices.forEach((choice, index) => {
    const pointer = index === args.selected ? blue(theme, "›") : " ";
    out.write(`  ${pointer} ${choice.line}\n`);
    lines++;
  });
  const hint = args.raw
    ? `Use ↑/↓ to move, Enter to select`
    : `Type a number or name, then press Enter`;
  out.write(`\n  ${dim(theme, hint)}\n`);
  lines += 2;
  return lines;
}

export class SetupInterruptedError extends Error {
  constructor() {
    super("setup interrupted");
  }
}

export function isSetupInterrupted(err: unknown): boolean {
  return err instanceof SetupInterruptedError;
}

function canUseRawSelect(input: SetupInputStream): boolean {
  return input.isTTY === true && typeof input.setRawMode === "function";
}

function clampIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  if (index < 0) return 0;
  if (index >= length) return length - 1;
  return index;
}
