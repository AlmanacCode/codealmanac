import { Command } from "commander";

import {
  runAgentsDoctor,
  runAgentsList,
  runAgentsModel,
  runAgentsUse,
  runSetAgentModel,
  runSetDefaultAgent,
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
    .description("read and write codealmanac settings");

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
    .action(async (key: string, value: string) => {
      emit(await runConfigSet({ key, value }));
    });

  config
    .command("unset")
    .description("restore one config value to default")
    .argument("<key>", "config key")
    .action(async (key: string) => {
      emit(await runConfigUnset({ key }));
    });

  program
    .command("set")
    .description("configure codealmanac defaults")
    .argument("<key>", "setting key, e.g. default-agent or model")
    .argument("[value...]", "setting value")
    .action(async (key: string, value: string[]) => {
      if (key === "default-agent") {
        emit(await runSetDefaultAgent({ provider: value[0] ?? "" }));
        return;
      }
      if (key === "model") {
        emit(await runSetAgentModel({
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
    .description("install the hook + CLAUDE.md guides (bare codealmanac alias)")
    .option("-y, --yes", "skip prompts; install everything")
    .option("--agent <agent>", "default agent: claude, codex, or cursor")
    .option("--skip-hook", "opt out of the SessionEnd hook")
    .option("--skip-guides", "opt out of the CLAUDE.md guides")
    .action(
      async (opts: {
        yes?: boolean;
        agent?: string;
        skipHook?: boolean;
        skipGuides?: boolean;
      }) => {
        const result = await runSetup({
          yes: opts.yes,
          agent: opts.agent,
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
