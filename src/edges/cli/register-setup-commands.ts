import { Command } from "commander";

import { currentCliProgramArguments } from "./current-cli.js";
import { emit, shouldUseStdoutColor } from "./helpers.js";

export interface SetupCommandDeps {
  runSetup?: typeof import("../../cli/commands/setup/index.js").runSetup;
  runDoctor?: typeof import("../../cli/commands/doctor/index.js").runDoctor;
}

export function registerSetupCommands(
  program: Command,
  deps: SetupCommandDeps = {},
): void {
  program
    .command("setup")
    .description("set up local Almanac access")
    .option("-y, --yes", "skip prompts; use setup defaults")
    .option("--agent <agent>", "default agent: claude, codex, or cursor")
    .option("--model <model>", "default model for the selected agent")
    .option("--skip-automation", "skip scheduled setup tasks")
    .option("--sync-every <duration>", "scheduled sync interval (default: 5h)")
    .option("--sync-quiet <duration>", "scheduled sync quiet window (default: 45m)")
    .option("--garden-every <duration>", "scheduled Garden interval (default: 4h)")
    .option("--garden-off", "disable scheduled Garden automation")
    .option("--auto-update", "install scheduled Almanac self-update")
    .option("--auto-update-every <duration>", "scheduled self-update interval (default: 1d)")
    .option("--skip-guides", "opt out of the CLAUDE.md guides")
    .option("--auto-commit", "allow Almanac lifecycle runs to commit wiki source changes")
    .option("--no-auto-commit", "leave lifecycle wiki changes in the working tree")
    .action(
      async (opts: {
        yes?: boolean;
        agent?: string;
        model?: string;
        skipAutomation?: boolean;
        syncEvery?: string;
        syncQuiet?: string;
        gardenEvery?: string;
        gardenOff?: boolean;
        autoUpdate?: boolean;
        autoUpdateEvery?: string;
        skipGuides?: boolean;
        autoCommit?: boolean;
      }) => {
        const runSetup = deps.runSetup ??
          (await import("../../cli/commands/setup/index.js")).runSetup;
        const result = await runSetup({
          yes: opts.yes,
          agent: opts.agent,
          model: opts.model,
          skipAutomation: opts.skipAutomation,
          automationEvery: opts.syncEvery,
          automationQuiet: opts.syncQuiet,
          gardenEvery: opts.gardenEvery,
          gardenOff: opts.gardenOff,
          autoUpdate: opts.autoUpdate,
          autoUpdateEvery: opts.autoUpdateEvery,
          skipGuides: opts.skipGuides,
          autoCommit: opts.autoCommit,
          cwd: process.cwd(),
          pathEnvironment: process.env.PATH,
          cliProgramArguments: currentCliProgramArguments(),
          color: shouldUseStdoutColor(),
        });
        emit(result);
      },
    );

  program
    .command("doctor")
    .description("report on the Almanac install + current wiki health")
    .option("--json", "emit structured JSON")
    .option("--install-only", "report only on the install (skip wiki checks)")
    .option("--wiki-only", "report only on the current wiki (skip install checks)")
    .action(
      async (opts: {
        json?: boolean;
        installOnly?: boolean;
        wikiOnly?: boolean;
      }) => {
        const runDoctor = deps.runDoctor ??
          (await import("../../cli/commands/doctor/index.js")).runDoctor;
        const result = await runDoctor({
          cwd: process.cwd(),
          claudeApiKeySet: process.env.ANTHROPIC_API_KEY !== undefined &&
            process.env.ANTHROPIC_API_KEY.length > 0,
          json: opts.json,
          installOnly: opts.installOnly,
          wikiOnly: opts.wikiOnly,
          color: shouldUseStdoutColor(),
        });
        emit(result);
      },
    );

  program
    .command("update")
    .description("install the latest Almanac package (synchronous foreground `npm i -g`)")
    .option(
      "--dismiss",
      "silence the update banner for the current `latest_version` without installing",
    )
    .option("--check", "force a registry check now (bypasses the 24h cache); no install")
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
        const { runUpdate } = await import("../../cli/commands/update.js");
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
    .description("remove automation + guides + import line")
    .option("-y, --yes", "skip confirmations; remove everything")
    .option("--keep-automation", "don't remove the scheduler (guides still prompted unless --yes)")
    .option(
      "--keep-guides",
      "don't remove the guides or CLAUDE.md import (scheduler still prompted unless --yes)",
    )
    .action(
      async (opts: {
        yes?: boolean;
        keepAutomation?: boolean;
        keepGuides?: boolean;
      }) => {
        const { runUninstall } = await import("../../cli/commands/uninstall.js");
        const result = await runUninstall({
          yes: opts.yes,
          keepAutomation: opts.keepAutomation,
          keepGuides: opts.keepGuides,
          color: shouldUseStdoutColor(),
        });
        emit(result);
      },
    );
}
