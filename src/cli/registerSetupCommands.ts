import { Command } from "commander";

import { runDoctor } from "../commands/doctor.js";
import { runSetup } from "../commands/setup.js";
import { runUninstall } from "../commands/uninstall.js";
import { runUpdate } from "../commands/update.js";
import { emit } from "./helpers.js";

export function registerSetupCommands(program: Command): void {
  program
    .command("setup")
    .description("install the hook + CLAUDE.md guides (bare codealmanac alias)")
    .option("-y, --yes", "skip prompts; install everything")
    .option("--skip-hook", "opt out of the SessionEnd hook")
    .option("--skip-guides", "opt out of the CLAUDE.md guides")
    .action(
      async (opts: {
        yes?: boolean;
        skipHook?: boolean;
        skipGuides?: boolean;
      }) => {
        const result = await runSetup({
          yes: opts.yes,
          skipHook: opts.skipHook,
          skipGuides: opts.skipGuides,
        });
        emit(result);
      },
    );

  program
    .command("doctor")
    .description("report on the codealmanac install + current wiki health")
    .option("--json", "emit structured JSON")
    .option("--install-only", "report only on the install (skip wiki checks)")
    .option("--wiki-only", "report only on the current wiki (skip install checks)")
    .action(
      async (opts: {
        json?: boolean;
        installOnly?: boolean;
        wikiOnly?: boolean;
      }) => {
        const result = await runDoctor({
          cwd: process.cwd(),
          json: opts.json,
          installOnly: opts.installOnly,
          wikiOnly: opts.wikiOnly,
        });
        emit(result);
      },
    );

  program
    .command("update")
    .description("install the latest codealmanac (synchronous foreground `npm i -g`)")
    .option(
      "--dismiss",
      "silence the update banner for the current `latest_version` without installing",
    )
    .option("--check", "force a registry check now (bypasses the 24h cache); no install")
    .option(
      "--enable-notifier",
      "re-enable the pre-command update banner (writes ~/.almanac/config.json)",
    )
    .option(
      "--disable-notifier",
      "silence the pre-command update banner (writes ~/.almanac/config.json)",
    )
    .action(
      async (opts: {
        dismiss?: boolean;
        check?: boolean;
        enableNotifier?: boolean;
        disableNotifier?: boolean;
      }) => {
        const result = await runUpdate({
          dismiss: opts.dismiss,
          check: opts.check,
          enableNotifier: opts.enableNotifier,
          disableNotifier: opts.disableNotifier,
        });
        emit(result);
      },
    );

  program
    .command("uninstall")
    .description("remove the hook + guides + import line")
    .option("-y, --yes", "skip confirmations; remove everything")
    .option("--keep-hook", "don't remove the SessionEnd hook (guides still prompted unless --yes)")
    .option(
      "--keep-guides",
      "don't remove the guides or CLAUDE.md import (hook still prompted unless --yes)",
    )
    .action(
      async (opts: {
        yes?: boolean;
        keepHook?: boolean;
        keepGuides?: boolean;
      }) => {
        const result = await runUninstall({
          yes: opts.yes,
          keepHook: opts.keepHook,
          keepGuides: opts.keepGuides,
        });
        emit(result);
      },
    );
}
