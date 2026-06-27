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
  BAR,
  BLUE,
  BOLD,
  DIM,
  RST,
  WHITE_BOLD,
} from "./output.js";

export async function chooseInstructionTargets(args: {
  out: NodeJS.WritableStream;
  interactive: boolean;
  requested?: readonly SetupInstructionTargetId[];
}): Promise<SetupInstructionTargetId[]> {
  if (args.requested !== undefined) return [...dedupeTargets(args.requested)];
  if (!args.interactive) return [...DEFAULT_SETUP_INSTRUCTION_TARGETS];
  if (canUseRawSelect()) return await chooseInstructionTargetsRaw(args.out);
  return await chooseInstructionTargetsLine(args.out);
}

async function chooseInstructionTargetsLine(
  out: NodeJS.WritableStream,
): Promise<SetupInstructionTargetId[]> {
  renderInstructionTargets(out, new Set(DEFAULT_SETUP_INSTRUCTION_TARGETS), 0, false);
  const answer = await promptText(out, "Select targets", "all");
  if (answer.trim().length === 0) return [...DEFAULT_SETUP_INSTRUCTION_TARGETS];
  return parseTargets(answer);
}

function chooseInstructionTargetsRaw(
  out: NodeJS.WritableStream,
): Promise<SetupInstructionTargetId[]> {
  return new Promise((resolve, reject) => {
    const selected = new Set<SetupInstructionTargetId>(DEFAULT_SETUP_INSTRUCTION_TARGETS);
    let cursor = 0;
    let renderedLines = 0;
    const input = process.stdin as NodeJS.ReadStream & {
      setRawMode?: (mode: boolean) => void;
    };
    const render = (): void => {
      if (renderedLines > 0) {
        out.write(`\x1b[${renderedLines}A\x1b[0J`);
      }
      renderedLines = renderInstructionTargets(out, selected, cursor, true);
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
  selected: Set<SetupInstructionTargetId>,
  cursor: number,
  raw: boolean,
): number {
  let lines = 0;
  out.write(`  ${BLUE}\u25c6${RST}  ${WHITE_BOLD}Where do you want to install Almanac?${RST}\n`);
  lines++;
  out.write(BAR + "\n");
  lines++;

  SETUP_INSTRUCTION_TARGETS.forEach((target, index) => {
    const arrow = index === cursor ? `${BLUE}\u276f${RST}` : " ";
    const check = selected.has(target.id) ? `${BLUE}\u2713${RST}` : " ";
    const label = index === cursor ? `${BOLD}${target.displayName}${RST}` : target.displayName;
    out.write(`  ${DIM}\u2502${RST}   ${arrow} [${check}] ${label}\n`);
    lines++;
  });

  out.write(BAR + "\n");
  lines++;
  const hint = raw
    ? `${BLUE}${BOLD}[space]${RST} toggle  ${BLUE}${BOLD}[↑↓]${RST} move  ${BLUE}${BOLD}[a]${RST} all  ${BLUE}${BOLD}[enter]${RST} confirm  ${DIM}[q] quit${RST}`
    : `${BLUE}${BOLD}all${RST}, numbers, or names separated by commas`;
  out.write(`  ${DIM}\u2502${RST}   ${hint}\n`);
  lines++;
  return lines;
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

function canUseRawSelect(): boolean {
  const input = process.stdin as NodeJS.ReadStream & {
    setRawMode?: (mode: boolean) => void;
  };
  return process.stdin.isTTY === true && typeof input.setRawMode === "function";
}
