import { Command } from "commander";

import {
  runAgentsDoctor,
  runAgentsList,
  runAgentsModel,
  runAgentsUse,
  runDeprecatedSetAgentModel,
  runDeprecatedSetDefaultAgent,
} from "../commands/agents.js";
import {
  runConfigGet,
  runConfigList,
  runConfigSet,
  runConfigUnset,
} from "../commands/config.js";
import { runDoctor } from "../commands/doctor.js";
import { runSetup } from "../commands/setup.js";
import { runUninstall } from "../commands/uninstall.js";
import { runUpdate } from "../commands/update.js";
import { emit } from "./helpers.js";

export function registerSetupCommands(program: Command): void {
  const agents = program
    .command("agents")
    .description("list supported AI agent providers and readiness");

  agents
    .command("list")
    .description("show Claude, Codex, and Cursor provider status")
    .action(async () => {
      emit(await runAgentsList());
    });

  agents
    .command("doctor")
    .description("diagnose supported AI agent providers")
    .action(async () => {
      emit(await runAgentsDoctor());
    });

  agents
    .command("use")
    .description("set the default AI agent provider")
    .argument("<provider>", "claude, codex, cursor, or claude/<model>")
    .action(async (provider: string) => {
      emit(await runAgentsUse({ provider }));
    });

  agents
    .command("model")
    .description("set or reset a provider model")
    .argument("<provider>", "claude, codex, or cursor")
    .argument("[model]", "provider-specific model id")
    .option("--default", "reset to provider default")
    .action(async (
      provider: string,
      model: string | undefined,
      opts: { default?: boolean },
    ) => {
      emit(await runAgentsModel({
        provider,
        model,
        defaultModel: opts.default,
      }));
    });

  const config = program
    .command("config")
    .description("read and write Almanac settings");

  config
    .command("list")
    .description("show supported config keys")
    .option("--json", "emit structured JSON")
    .option("--show-origin", "show whether each value came from file or default")
    .action(async (opts: { json?: boolean; showOrigin?: boolean }) => {
      emit(await runConfigList(opts));
    });

  config
    .command("get")
    .description("print one config value")
    .argument("<key>", "config key")
    .option("--json", "emit structured JSON")
    .option("--show-origin", "show whether the value came from file or default")
    .action(async (
      key: string,
      opts: { json?: boolean; showOrigin?: boolean },
    ) => {
      emit(await runConfigGet({ key, ...opts }));
    });

  config
    .command("set")
    .description("set one config value")
    .argument("<key>", "config key")
    .argument("<value>", "config value")
    .option("--project", "write .almanac/config.toml for this repo")
    .action(async (
      key: string,
      value: string,
      opts: { project?: boolean },
    ) => {
      emit(await runConfigSet({ key, value, project: opts.project }));
    });

  config
    .command("unset")
    .description("restore one config value to default")
    .argument("<key>", "config key")
    .option("--project", "remove from .almanac/config.toml for this repo")
    .action(async (key: string, opts: { project?: boolean }) => {
      emit(await runConfigUnset({ key, project: opts.project }));
    });

  program
    .command("set")
    .description("configure Almanac defaults")
    .argument("<key>", "setting key, e.g. default-agent or model")
    .argument("[value...]", "setting value")
    .action(async (key: string, value: string[]) => {
      if (key === "default-agent") {
        emit(await runDeprecatedSetDefaultAgent({ provider: value[0] ?? "" }));
        return;
      }
      if (key === "model") {
        emit(await runDeprecatedSetAgentModel({
          provider: value[0] ?? "",
          model: value[1],
        }));
        return;
      }
      emit({
        stdout: "",
        stderr:
          "almanac: unknown setting. Use `default-agent` or `model`.\n",
        exitCode: 1,
      });
    });

  program
    .command("setup")
    .description("install automation + agent guides")
    .option("-y, --yes", "skip prompts; install everything")
    .option("--agent <agent>", "default agent: claude, codex, or cursor")
    .option("--model <model>", "default model for the selected agent")
    .option("--skip-automation", "opt out of scheduled auto-capture")
    .option("--auto-capture-every <duration>", "scheduled auto-capture interval (default: 5h)")
    .option("--auto-capture-quiet <duration>", "scheduled auto-capture quiet window (default: 45m)")
    .option("--skip-guides", "opt out of the CLAUDE.md guides")
    .option("--auto-commit", "allow Almanac lifecycle runs to commit wiki source changes")
    .action(
      async (opts: {
        yes?: boolean;
        agent?: string;
        model?: string;
        skipAutomation?: boolean;
        autoCaptureEvery?: string;
        autoCaptureQuiet?: string;
        skipGuides?: boolean;
        autoCommit?: boolean;
      }) => {
        const result = await runSetup({
          yes: opts.yes,
          agent: opts.agent,
          model: opts.model,
          skipAutomation: opts.skipAutomation,
          automationEvery: opts.autoCaptureEvery,
          automationQuiet: opts.autoCaptureQuiet,
          skipGuides: opts.skipGuides,
          autoCommit: opts.autoCommit,
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
        const result = await runUninstall({
          yes: opts.yes,
          keepAutomation: opts.keepAutomation,
          keepGuides: opts.keepGuides,
        });
        emit(result);
      },
    );
}
