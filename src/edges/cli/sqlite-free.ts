import { homedir } from "node:os";

import { runCodealmanacBootstrap } from "../../platform/install/global.js";
import { currentCliProgramArguments } from "./current-cli.js";
import { emit, shouldUseStdoutColor } from "./helpers.js";
import { tryParseSetupShortcut } from "./setup-shortcut.js";

export interface SqliteFreeDeps {
  runSetup?: typeof import("./setup/index.js").runSetup;
  runCodealmanacBootstrap?: typeof runCodealmanacBootstrap;
}

export async function tryRunSetupShortcut(args: {
  programName: "almanac" | "codealmanac";
  argvArgs: string[];
  deps: SqliteFreeDeps;
}): Promise<boolean> {
  if (args.programName !== "almanac" && args.programName !== "codealmanac") {
    return false;
  }
  const setupInvocation = tryParseSetupShortcut(args.argvArgs);
  if (setupInvocation === null) return false;
  const setupOptions = {
    ...setupInvocation,
    cwd: process.cwd(),
    homeDir: homedir(),
    pathEnvironment: process.env.PATH,
    environment: process.env,
    cliProgramArguments: currentCliProgramArguments(),
    isTTY: process.stdin.isTTY === true,
    stdin: process.stdin,
    stdout: process.stdout,
    color: shouldUseStdoutColor(),
  };

  const runSetupFn = args.deps.runSetup ??
    (await import("./setup/index.js")).runSetup;
  const runCodealmanacBootstrapFn =
    args.deps.runCodealmanacBootstrap ?? runCodealmanacBootstrap;

  if (
    args.programName === "codealmanac" &&
    args.deps.runCodealmanacBootstrap !== undefined
  ) {
    emit(
      await runCodealmanacBootstrapFn({
        setupArgs: args.argvArgs,
        runLocalSetup: () => runSetupFn(setupOptions),
      }),
    );
  } else if (args.programName === "almanac" || args.deps.runSetup !== undefined) {
    emit(await runSetupFn(setupOptions));
  } else {
    emit(
      await runCodealmanacBootstrapFn({
        setupArgs: args.argvArgs,
        runLocalSetup: () => runSetupFn(setupOptions),
      }),
    );
  }
  return true;
}
