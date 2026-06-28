import {
  DEFAULT_SETUP_INSTRUCTION_TARGETS,
  SETUP_INSTRUCTION_TARGETS,
  type SetupInstructionTargetId,
} from "../../../services/setup/index.js";
import {
  SetupInterruptedError,
  promptText,
} from "./input.js";
import {
  blue,
  bold,
  controlLabel,
  dim,
  type SetupTheme,
  whiteBold,
  writeSetupDivider,
} from "./output.js";
import type { SetupInputStream } from "./types.js";

export async function chooseInstructionTargets(args: {
  input: SetupInputStream;
  out: NodeJS.WritableStream;
  theme: SetupTheme;
  interactive: boolean;
  requested?: readonly SetupInstructionTargetId[];
}): Promise<SetupInstructionTargetId[]> {
  if (args.requested !== undefined) return [...dedupeTargets(args.requested)];
  if (!args.interactive) return [...DEFAULT_SETUP_INSTRUCTION_TARGETS];
  if (canUseRawSelect(args.input)) {
    return await chooseInstructionTargetsRaw(args.input, args.out, args.theme);
  }
  return await chooseInstructionTargetsLine(args.input, args.out, args.theme);
}

async function chooseInstructionTargetsLine(
  input: SetupInputStream,
  out: NodeJS.WritableStream,
  theme: SetupTheme,
): Promise<SetupInstructionTargetId[]> {
  renderInstructionTargets(
    out,
    theme,
    new Set(DEFAULT_SETUP_INSTRUCTION_TARGETS),
    0,
    false,
  );
  const answer = await promptText(input, out, theme, "Select targets", "all");
  if (answer.trim().length === 0) return [...DEFAULT_SETUP_INSTRUCTION_TARGETS];
  return parseTargets(answer);
}

function chooseInstructionTargetsRaw(
  input: SetupInputStream,
  out: NodeJS.WritableStream,
  theme: SetupTheme,
): Promise<SetupInstructionTargetId[]> {
  return new Promise((resolve, reject) => {
    const selected = new Set<SetupInstructionTargetId>(DEFAULT_SETUP_INSTRUCTION_TARGETS);
    let cursor = 0;
    let renderedLines = 0;
    const render = (): void => {
      if (renderedLines > 0) {
        out.write(`\x1b[${renderedLines}A\x1b[0J`);
      }
      renderedLines = renderInstructionTargets(out, theme, selected, cursor, true);
    };
    const cleanup = (): void => {
      input.removeListener("data", onData);
      input.setRawMode?.(false);
      input.pause();
    };
    const onData = (chunk: Buffer): void => {
      const key = chunk.toString("utf8");
      if (key === "\u0003" || key === "q") {
        cleanup();
        out.write("\n");
        reject(new SetupInterruptedError());
        return;
      }
      if (key === "\u001b[A" || key === "k") {
        cursor = cursor === 0 ? SETUP_INSTRUCTION_TARGETS.length - 1 : cursor - 1;
        render();
        return;
      }
      if (key === "\u001b[B" || key === "j") {
        cursor = cursor === SETUP_INSTRUCTION_TARGETS.length - 1 ? 0 : cursor + 1;
        render();
        return;
      }
      if (key === " ") {
        const id = SETUP_INSTRUCTION_TARGETS[cursor]!.id;
        if (selected.has(id)) selected.delete(id);
        else selected.add(id);
        render();
        return;
      }
      if (key === "a") {
        const allSelected = selected.size === SETUP_INSTRUCTION_TARGETS.length;
        selected.clear();
        if (!allSelected) {
          for (const target of SETUP_INSTRUCTION_TARGETS) selected.add(target.id);
        }
        render();
        return;
      }
      if (key === "\r" || key === "\n") {
        cleanup();
        out.write("\n");
        resolve(orderedTargets(selected));
      }
    };
    input.setRawMode?.(true);
    input.resume();
    input.on("data", onData);
    render();
  });
}

function renderInstructionTargets(
  out: NodeJS.WritableStream,
  theme: SetupTheme,
  selected: Set<SetupInstructionTargetId>,
  cursor: number,
  raw: boolean,
): number {
  let lines = 0;
  out.write(
    `  ${blue(theme, "\u25c6")}  ${whiteBold(
      theme,
      "Where do you want to install Almanac?",
    )}\n`,
  );
  lines++;
  writeSetupDivider(out, theme);
  lines++;

  SETUP_INSTRUCTION_TARGETS.forEach((target, index) => {
    const arrow = index === cursor ? blue(theme, "\u276f") : " ";
    const check = selected.has(target.id)
      ? blue(theme, "\u2713")
      : " ";
    const label = index === cursor
      ? bold(theme, target.displayName)
      : target.displayName;
    out.write(`  ${dim(theme, "\u2502")}   ${arrow} [${check}] ${label}\n`);
    lines++;
  });

  writeSetupDivider(out, theme);
  lines++;
  const hint = raw ? rawModeHint(theme) : lineModeHint(theme);
  out.write(`  ${dim(theme, "\u2502")}   ${hint}\n`);
  lines++;
  return lines;
}

function rawModeHint(theme: SetupTheme): string {
  return [
    `${controlLabel(theme, "[space]")} toggle`,
    `${controlLabel(theme, "[↑↓]")} move`,
    `${controlLabel(theme, "[a]")} all`,
    `${controlLabel(theme, "[enter]")} confirm`,
    `${dim(theme, "[q] quit")}`,
  ].join("  ");
}

function lineModeHint(theme: SetupTheme): string {
  return `${controlLabel(theme, "all")}, numbers, or names separated by commas`;
}

function parseTargets(value: string): SetupInstructionTargetId[] {
  const normalized = value.trim().toLowerCase();
  if (normalized.length === 0 || normalized === "all") {
    return [...DEFAULT_SETUP_INSTRUCTION_TARGETS];
  }
  if (normalized === "none" || normalized === "no" || normalized === "skip") {
    return [];
  }
  const targets: SetupInstructionTargetId[] = [];
  for (const part of normalized.split(",").map((item) => item.trim())) {
    const byNumber = Number.parseInt(part, 10);
    if (Number.isInteger(byNumber)) {
      const target = SETUP_INSTRUCTION_TARGETS[byNumber - 1];
      if (target !== undefined) targets.push(target.id);
      continue;
    }
    const matched = SETUP_INSTRUCTION_TARGETS.find((target) =>
      target.id === part ||
      target.displayName.toLowerCase() === part ||
      target.displayName.toLowerCase().replace(/\s+/g, "-") === part
    );
    if (matched !== undefined) targets.push(matched.id);
  }
  return [...dedupeTargets(targets)];
}

function orderedTargets(
  selected: Set<SetupInstructionTargetId>,
): SetupInstructionTargetId[] {
  return SETUP_INSTRUCTION_TARGETS
    .map((target) => target.id)
    .filter((id) => selected.has(id));
}

function dedupeTargets(
  targets: readonly SetupInstructionTargetId[],
): readonly SetupInstructionTargetId[] {
  const seen = new Set<SetupInstructionTargetId>();
  for (const target of targets) seen.add(target);
  return orderedTargets(seen);
}

function canUseRawSelect(input: SetupInputStream): boolean {
  return input.isTTY === true && typeof input.setRawMode === "function";
}
