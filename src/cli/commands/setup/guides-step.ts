import {
  installSetupInstructions,
  type SetupInstructionTargetId,
} from "../../../services/setup/index.js";
import {
  BAR,
  DIM,
  RST,
  stepDone,
  stepSkipped,
} from "./output.js";

export interface GuidesSetupStepOptions {
  skipGuides?: boolean;
  claudeDir?: string;
  codexDir?: string;
  cursorDir?: string;
  windsurfDir?: string;
  opencodeDir?: string;
  guidesDir?: string;
}

export type GuidesSetupStepResult =
  | { ok: true }
  | { ok: false; stderr: string; exitCode: number };

export async function runGuidesSetupStep(args: {
  out: NodeJS.WritableStream;
  options: GuidesSetupStepOptions;
  targets: readonly SetupInstructionTargetId[];
}): Promise<GuidesSetupStepResult> {
  if (args.options.skipGuides === true || args.targets.length === 0) {
    stepSkipped(args.out, `Agent instructions ${DIM}skipped${RST}`);
    args.out.write(BAR + "\n");
    return { ok: true };
  }

  try {
    const summary = await installSetupInstructions({
      targets: args.targets,
      claudeDir: args.options.claudeDir,
      codexDir: args.options.codexDir,
      cursorDir: args.options.cursorDir,
      windsurfDir: args.options.windsurfDir,
      opencodeDir: args.options.opencodeDir,
      guidesDir: args.options.guidesDir,
    });
    const guidesSummary = summary.anyChanges
      ? "Agent instructions added"
      : `Agent instructions ${DIM}already added${RST}`;
    stepDone(args.out, guidesSummary);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      stderr: `almanac: guide install failed: ${msg}\n`,
      exitCode: 1,
    };
  }
  args.out.write(BAR + "\n");
  return { ok: true };
}
