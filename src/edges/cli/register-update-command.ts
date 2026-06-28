import { Command } from "commander";

import { emit } from "./helpers.js";
import { createUpdateRuntime } from "../../app/update-runtime.js";

export function registerUpdateCommand(program: Command): void {
  program
    .command("update")
    .description(
      "install the latest Almanac package (synchronous foreground `npm i -g`)",
    )
    .option(
      "--dismiss",
      "silence the update banner for the current `latest_version` without installing",
    )
    .option(
      "--check",
      "force a registry check now (bypasses the 24h cache); no install",
    )
    .option(
      "--enable-notifier",
      "deprecated: use `almanac config set update_notifier true`",
    )
    .option(
      "--disable-notifier",
      "deprecated: use `almanac config set update_notifier false`",
    )
    .action(
      async (opts: {
        dismiss?: boolean;
        check?: boolean;
        enableNotifier?: boolean;
        disableNotifier?: boolean;
      }) => {
        const { runUpdate } = await import("./commands/update.js");
        const result = await runUpdate({
          dismiss: opts.dismiss,
          check: opts.check,
          enableNotifier: opts.enableNotifier,
          disableNotifier: opts.disableNotifier,
          runtime: createUpdateRuntime(),
          pid: process.pid,
        });
        emit(result);
      },
    );
}
