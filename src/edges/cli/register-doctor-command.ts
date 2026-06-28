import { Command } from "commander";
import { homedir } from "node:os";

import { readDoctorRuntimeFacts } from "../../app/diagnostics-runtime.js";
import { emit, shouldUseStdoutColor } from "./helpers.js";

export interface RegisterDoctorCommandDeps {
  runDoctor?: typeof import("./commands/doctor/index.js").runDoctor;
}

export function registerDoctorCommand(
  program: Command,
  deps: RegisterDoctorCommandDeps = {},
): void {
  program
    .command("doctor")
    .description("report on the Almanac install + current wiki health")
    .option("--json", "emit structured JSON")
    .option("--install-only", "report only on the install (skip wiki checks)")
    .option(
      "--wiki-only",
      "report only on the current wiki (skip install checks)",
    )
    .action(
      async (opts: {
        json?: boolean;
        installOnly?: boolean;
        wikiOnly?: boolean;
      }) => {
        const runDoctor = deps.runDoctor ??
          (await import("./commands/doctor/index.js")).runDoctor;
        const runtimeFacts = await readDoctorRuntimeFacts({
          environment: process.env,
          homeDir: homedir(),
          nodeVersion: process.version,
        });
        const result = await runDoctor({
          cwd: process.cwd(),
          ...runtimeFacts,
          json: opts.json,
          installOnly: opts.installOnly,
          wikiOnly: opts.wikiOnly,
          color: shouldUseStdoutColor(),
        });
        emit(result);
      },
    );
}
