import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { runCloudStatus } from "../src/cli/commands/cloud.js";
import { installClaudeCloudHooks, readClaudeCloudHookStatus } from "../src/platform/cloud-hooks/claude.js";
import { installCodexCloudHooks, readCodexCloudHookStatus } from "../src/platform/cloud-hooks/codex.js";
import { withTempHome } from "./helpers.js";

describe("cloud hook installation", () => {
  it("installs Codex UserPromptSubmit and Stop hooks without replacing unrelated hooks", async () => {
    await withTempHome(async (home) => {
      const hooksPath = join(home, ".codex", "hooks.json");
      await mkdir(join(home, ".codex"), { recursive: true });
      await writeFile(
        hooksPath,
        JSON.stringify({
          hooks: {
            Stop: [{ hooks: [{ type: "command", command: "other-tool flush" }] }],
          },
        }),
        "utf8",
      );

      const first = await installCodexCloudHooks({ homeDir: home });
      const second = await installCodexCloudHooks({ homeDir: home });
      const config = JSON.parse(await readFile(hooksPath, "utf8")) as {
        hooks: Record<string, Array<{ hooks: Array<{ command: string }> }>>;
      };

      expect(first.changed).toBe(true);
      expect(second.changed).toBe(false);
      expect((config.hooks.Stop ?? []).flatMap((entry) =>
        entry.hooks.map((hook) => hook.command)
      ))
        .toEqual([
          "other-tool flush",
          "almanac cloud capture-hook --provider codex --event Stop",
        ]);
      expect((config.hooks.UserPromptSubmit ?? []).flatMap((entry) =>
        entry.hooks.map((hook) => hook.command)
      )).toEqual([
        "almanac cloud capture-hook --provider codex --event UserPromptSubmit",
      ]);
      await expect(readCodexCloudHookStatus({ homeDir: home })).resolves.toMatchObject({
        provider: "codex",
        installed: true,
      });
    });
  });

  it("installs Claude UserPromptSubmit and Stop hooks in settings.json", async () => {
    await withTempHome(async (home) => {
      const result = await installClaudeCloudHooks({ homeDir: home });
      const settings = JSON.parse(
        await readFile(join(home, ".claude", "settings.json"), "utf8"),
      ) as { hooks: Record<string, Array<{ hooks: Array<{ command: string }> }>> };

      expect(result.changed).toBe(true);
      expect((settings.hooks.UserPromptSubmit ?? [])[0]?.hooks[0]?.command).toBe(
        "almanac cloud capture-hook --provider claude --event UserPromptSubmit",
      );
      expect((settings.hooks.Stop ?? [])[0]?.hooks[0]?.command).toBe(
        "almanac cloud capture-hook --provider claude --event Stop",
      );
      await expect(readClaudeCloudHookStatus({ homeDir: home })).resolves.toMatchObject({
        provider: "claude",
        installed: true,
      });
    });
  });
});

describe("cloud status hook reporting", () => {
  it("reports installed and missing hook states without requiring login", async () => {
    await withTempHome(async (home) => {
      await installCodexCloudHooks({ homeDir: home });

      const status = await runCloudStatus({ cwd: home, json: true });
      const body = JSON.parse(status.stdout) as {
        loggedIn: boolean;
        hooks: {
          codex: { installed: boolean };
          claude: { installed: boolean };
        };
      };

      expect(body.loggedIn).toBe(false);
      expect(body.hooks.codex.installed).toBe(true);
      expect(body.hooks.claude.installed).toBe(false);
    });
  });
});
