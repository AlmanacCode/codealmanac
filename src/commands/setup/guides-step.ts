import { homedir } from "node:os";
import path from "node:path";

import { installAgentInstructions } from "../../agent/install-targets.js";
import {
  BAR,
  DIM,
  type InstallDecision,
  RST,
  confirm,
  stepDone,
  stepSkipped,
} from "./output.js";
import { resolveGuidesDir } from "./guides.js";

export interface GuidesSetupStepOptions {
  skipGuides?: boolean;
  claudeDir?: string;
  codexDir?: string;
  guidesDir?: string;
}

export type GuidesSetupStepResult =
  | { ok: true }
  | { ok: false; stderr: string; exitCode: number };

export async function runGuidesSetupStep(args: {
  out: NodeJS.WritableStream;
  interactive: boolean;
  options: GuidesSetupStepOptions;
}): Promise<GuidesSetupStepResult> {
  let guidesAction: InstallDecision = "install";
  if (args.options.skipGuides === true) {
    guidesAction = "skip";
  } else if (args.interactive) {
    guidesAction = await confirm(
      args.out,
      "Add Almanac instructions for your AI agents?",
      true,
    );
  }

  if (guidesAction === "install") {
    try {
      const summary = await installAgentInstructions({
        claudeDir: args.options.claudeDir ?? path.join(homedir(), ".claude"),
        codexDir: args.options.codexDir ?? path.join(homedir(), ".codex"),
        guidesDir: args.options.guidesDir ?? resolveGuidesDir(),
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
  } else {
    stepSkipped(args.out, `Agent instructions ${DIM}skipped${RST}`);
  }
  args.out.write(BAR + "\n");
  return { ok: true };
}
