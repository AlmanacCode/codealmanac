import {
  detectCurrentInstallPath,
  detectEphemeral,
  spawnGlobalInstall,
} from "./install-path.js";
import {
  BAR,
  DIM,
  type InstallDecision,
  RST,
  confirm,
  stepActive,
  stepDone,
  stepSkipped,
} from "./output.js";

export interface GlobalInstallStepOptions {
  installPath?: string | null;
  spawnGlobalInstall?: () => Promise<void>;
}

export interface GlobalInstallStepResult {
  ephemeral: boolean;
  durableGlobalInstall: boolean;
}

export async function runGlobalInstallStep(args: {
  out: NodeJS.WritableStream;
  interactive: boolean;
  options: GlobalInstallStepOptions;
}): Promise<GlobalInstallStepResult> {
  const ephemeral = args.options.installPath !== undefined
    ? (args.options.installPath !== null
        ? detectEphemeral(args.options.installPath)
        : false)
    : detectEphemeral(detectCurrentInstallPath());
  let durableGlobalInstall = false;
  if (!ephemeral) {
    return { ephemeral, durableGlobalInstall };
  }

  let globalAction: InstallDecision = "install";
  if (args.interactive) {
    globalAction = await confirm(
      args.out,
      `Running from an ephemeral npx location. Install globally so 'almanac' stays on PATH?`,
      true,
    );
  }
  if (globalAction === "install") {
    stepActive(args.out, "Installing Almanac package globally...");
    try {
      await (args.options.spawnGlobalInstall ?? spawnGlobalInstall)();
      durableGlobalInstall = true;
      stepDone(args.out, "Almanac installed globally (almanac now on PATH)");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      stepActive(args.out, `Global install failed: ${msg}`);
      args.out.write(
        `  ${DIM}You can retry manually: npm install -g codealmanac${RST}\n`,
      );
    }
  } else {
    stepSkipped(
      args.out,
      `Global install ${DIM}skipped — almanac will not be on PATH after this session${RST}`,
    );
  }
  args.out.write(BAR + "\n");
  return { ephemeral, durableGlobalInstall };
}
