import { writeConfig } from "../../config/index.js";
import {
  BAR,
  DIM,
  type InstallDecision,
  RST,
  confirm,
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
  let autoCommitAction: InstallDecision = "skip";
  if (args.options.autoCommit === true) {
    autoCommitAction = "install";
  } else if (args.interactive) {
    autoCommitAction = await confirm(
      args.out,
      "Commit Almanac wiki updates automatically?",
      false,
    );
  }

  if (autoCommitAction === "install") {
    await writeConfig({ auto_commit: true });
    stepDone(args.out, "Auto-commit enabled");
  } else {
    if (args.interactive) await writeConfig({ auto_commit: false });
    stepSkipped(args.out, `Auto-commit ${DIM}disabled${RST}`);
  }
  args.out.write(BAR + "\n");
}
