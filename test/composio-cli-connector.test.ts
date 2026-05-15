import { chmod, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { ComposioCli, parseCliJson } from "../src/connectors/composio-cli.js";
import { NotionCliConnector } from "../src/connectors/notion-cli.js";
import { withTempHome } from "./helpers.js";

describe("Composio CLI connector", () => {
  it("parses JSON after CLI update banners", () => {
    expect(parseCliJson("Update available\n{\"ok\":true}\nmore logs\n")).toEqual({ ok: true });
  });

  it("follows Composio CLI stored output files", async () => {
    await withTempHome(async (tempHome) => {
      const output = join(tempHome, "tool-output.json");
      const bin = join(tempHome, "composio");
      await writeFile(output, "{\"successful\":true,\"data\":{\"ok\":true}}\n", "utf8");
      await writeFile(
        bin,
        [
          "#!/usr/bin/env node",
          `console.log(${JSON.stringify(JSON.stringify({
            storedInFile: true,
            outputFilePath: output,
          }))})`,
        ].join("\n"),
        "utf8",
      );
      await chmod(bin, 0o755);

      await expect(new ComposioCli({ bin }).execute("NOTION_FETCH_DATA", {}))
        .resolves.toMatchObject({
          successful: true,
          data: { ok: true },
        });
    });
  });

  it("uses Composio CLI tools for broad Notion ingest", async () => {
    const calls: string[][] = [];
    const connector = new NotionCliConnector({
      cli: new ComposioCli({
        run: async (args) => {
          calls.push(args);
          if (args[1] === "NOTION_FETCH_DATA") {
            return {
              successful: true,
              data: {
                values: [
                  { id: "0123456789abcdef0123456789abcdef", title: "Wiki", type: "page" },
                ],
              },
            };
          }
          return {
            successful: true,
            data: {
              title: "Wiki",
              url: "https://notion.so/Wiki-0123456789abcdef0123456789abcdef",
              markdown: "Connector notes from Notion.",
            },
          };
        },
      }),
      now: () => new Date("2026-05-15T12:00:00.000Z"),
    });

    const bundle = await connector.fetchBundle({ kind: "workspace", value: "notion" });

    expect(calls.map((call) => call[1])).toEqual([
      "NOTION_FETCH_DATA",
      "NOTION_GET_PAGE_MARKDOWN",
    ]);
    expect(bundle.documents[0]).toMatchObject({
      title: "Wiki",
      text: "Connector notes from Notion.",
    });
  });

  it("rejects data-source selectors because the CLI fallback cannot fetch them yet", async () => {
    const connector = new NotionCliConnector({
      cli: new ComposioCli({ run: async () => ({ successful: true, data: {} }) }),
    });

    await expect(
      connector.fetchBundle({ kind: "data-source", value: "ds_123" }),
    ).rejects.toThrow("data-source ingest is not supported through the Composio CLI fallback");
  });
});
