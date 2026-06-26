import { readConfig, writeConfig } from "../../../config/index.js";
import {
  BAR,
  DIM,
  type InstallDecision,
  RST,
  stepDone,
  stepSkipped,
} from "./output.js";

export interface AutoCommitSetupStepOptions {
  autoCommit?: boolean;
}

export async function runAutoCommitSetupStep(args: {
  out: NodeJS.WritableStream;
  interactive: boolean;
  options: AutoCommitSetupStepOptions;
}): Promise<void> {
  let autoCommitAction: InstallDecision | "preserve" = "preserve";
  if (args.options.autoCommit === false) {
    autoCommitAction = "skip";
  } else if (args.options.autoCommit === true) {
    autoCommitAction = "install";
  }

  if (autoCommitAction === "install") {
    await writeConfig({ auto_commit: true });
    stepDone(args.out, "Auto-commit enabled");
  } else if (autoCommitAction === "skip") {
    await writeConfig({ auto_commit: false });
    stepSkipped(args.out, `Auto-commit ${DIM}disabled${RST}`);
  } else {
    const config = await readConfig();
    if (config.auto_commit) {
      stepDone(args.out, "Auto-commit enabled");
    } else {
      stepSkipped(args.out, `Auto-commit ${DIM}disabled${RST}`);
    }
  }
  args.out.write(BAR + "\n");
}
