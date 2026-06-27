import {
  installSetupInstructions,
  type SetupInstructionTargetId,
} from "../../../services/setup/index.js";
import {
  type SetupTheme,
  dim,
  stepDone,
  stepSkipped,
  writeSetupDivider,
} from "./output.js";

export interface GuidesSetupStepOptions {
  skipGuides?: boolean;
  homeDir: string;
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
  theme: SetupTheme;
  options: GuidesSetupStepOptions;
  targets: readonly SetupInstructionTargetId[];
}): Promise<GuidesSetupStepResult> {
  if (args.options.skipGuides === true || args.targets.length === 0) {
    stepSkipped(
      args.out,
      args.theme,
      `Agent instructions ${dim(args.theme, "skipped")}`,
    );
    writeSetupDivider(args.out, args.theme);
    return { ok: true };
  }

  try {
    const summary = await installSetupInstructions({
      targets: args.targets,
      homeDir: args.options.homeDir,
      claudeDir: args.options.claudeDir,
      codexDir: args.options.codexDir,
      cursorDir: args.options.cursorDir,
      windsurfDir: args.options.windsurfDir,
      opencodeDir: args.options.opencodeDir,
      guidesDir: requireSetupGuidesDir(args.options.guidesDir),
    });
    const guidesSummary = summary.anyChanges
      ? "Agent instructions added"
      : `Agent instructions ${dim(args.theme, "already added")}`;
    stepDone(args.out, args.theme, guidesSummary);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      stderr: `almanac: guide install failed: ${msg}\n`,
      exitCode: 1,
    };
  }
  writeSetupDivider(args.out, args.theme);
  return { ok: true };
}

function requireSetupGuidesDir(guidesDir: string | undefined): string {
  if (guidesDir !== undefined) return guidesDir;
  throw new Error("bundled guides directory was not provided");
}
