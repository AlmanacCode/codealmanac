import { applySetupAutoCommit } from "../../../services/setup/index.js";
import {
  type SetupTheme,
  dim,
  stepDone,
  stepSkipped,
  writeSetupDivider,
} from "./output.js";

export interface AutoCommitSetupStepOptions {
  autoCommit?: boolean;
}

export async function runAutoCommitSetupStep(args: {
  out: NodeJS.WritableStream;
  theme: SetupTheme;
  interactive: boolean;
  options: AutoCommitSetupStepOptions;
}): Promise<void> {
  const result = await applySetupAutoCommit({
    autoCommit: args.options.autoCommit,
  });
  if (result.enabled) {
    stepDone(args.out, args.theme, "Auto-commit enabled");
  } else {
    stepSkipped(
      args.out,
      args.theme,
      `Auto-commit ${dim(args.theme, "disabled")}`,
    );
  }
  writeSetupDivider(args.out, args.theme);
}
