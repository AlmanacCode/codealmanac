import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { ComposioClient } from "../src/connectors/composio.js";
import { ComposioCli } from "../src/connectors/composio-cli.js";
import { getConnectorStorePath } from "../src/connectors/store.js";
import {
  runConnectNotionCommand,
  runConnectorsStatusCommand,
  runDisconnectNotionCommand,
} from "../src/commands/connectors.js";
import { withTempHome } from "./helpers.js";

describe("connector commands", () => {
  it("reports missing Composio API credentials as the main self-hosted setup path", async () => {
    await withTempHome(async () => {
      const originalKey = process.env.COMPOSIO_API_KEY;
      const originalAuthConfig = process.env.COMPOSIO_NOTION_AUTH_CONFIG_ID;
      delete process.env.COMPOSIO_API_KEY;
      delete process.env.COMPOSIO_NOTION_AUTH_CONFIG_ID;
      try {
        const result = await runConnectNotionCommand();

        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain("Composio API credentials are required");
        expect(result.stderr).toContain("COMPOSIO_API_KEY");
        expect(result.stderr).toContain("COMPOSIO_NOTION_AUTH_CONFIG_ID");
        expect(result.stderr).toContain("almanac connect notion --from-composio-cli");
      } finally {
        process.env.COMPOSIO_API_KEY = originalKey;
        process.env.COMPOSIO_NOTION_AUTH_CONFIG_ID = originalAuthConfig;
      }
    });
  });

  it("connects Notion through an already-linked Composio CLI", async () => {
    await withTempHome(async () => {
      const result = await runConnectNotionCommand({
        fromComposioCli: true,
        composioCli: new ComposioCli({
          run: async (args) => {
            if (args[0] === "whoami") {
              return { email: "reverie@example.com", test_user_id: "pg-test" };
            }
            return {
              connected_toolkits: ["notion"],
              results: [],
            };
          },
        }),
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe("Notion connected through Composio CLI\n");
      const stored = await readFile(getConnectorStorePath(), "utf8");
      expect(stored).toContain("cli:notion");
      expect(stored).toContain("\"mode\": \"cli\"");
    });
  });

  it("creates a Composio link session and stores only the connected-account reference", async () => {
    await withTempHome(async () => {
      const opened: string[] = [];
      const composio = new ComposioClient({
        apiKey: "secret_key_never_stored",
        fetch: fakeFetch([
          {
            status: 201,
            body: {
              link_token: "link_123",
              redirect_url: "https://connect.composio.dev/notion",
              expires_at: "2026-05-15T12:10:00.000Z",
              connected_account_id: "ca_notion_123",
            },
          },
        ]),
      });

      const result = await runConnectNotionCommand({
        composio,
        apiKey: "secret_key_never_stored",
        authConfigId: "ac_notion",
        userId: "user_local",
        wait: false,
        openUrl: async (url) => {
          opened.push(url);
        },
        now: () => new Date("2026-05-15T12:00:00.000Z"),
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Notion authorization started");
      expect(opened).toEqual(["https://connect.composio.dev/notion"]);
      const stored = await readFile(getConnectorStorePath(), "utf8");
      expect(stored).toContain("ca_notion_123");
      expect(stored).toContain("ac_notion");
      expect(stored).not.toContain("secret_key_never_stored");
      expect(stored).not.toContain("link_123");
    });
  });

  it("prints the authorization URL immediately for manual browser auth", async () => {
    await withTempHome(async () => {
      const composio = new ComposioClient({
        apiKey: "secret",
        fetch: fakeFetch([
          {
            status: 201,
            body: {
              link_token: "link_123",
              redirect_url: "https://connect.composio.dev/notion",
              expires_at: "2026-05-15T12:10:00.000Z",
              connected_account_id: "ca_notion_123",
            },
          },
        ]),
      });

      const result = await runConnectNotionCommand({
        composio,
        apiKey: "secret",
        authConfigId: "ac_notion",
        noOpen: true,
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Authorize: https://connect.composio.dev/notion");
      expect(result.stdout).toContain("Run `almanac connectors status` after authorizing.");
    });
  });

  it("falls back to manual auth when opening the browser fails", async () => {
    await withTempHome(async () => {
      const composio = new ComposioClient({
        apiKey: "secret",
        fetch: fakeFetch([
          {
            status: 201,
            body: {
              link_token: "link_123",
              redirect_url: "https://connect.composio.dev/notion",
              expires_at: "2026-05-15T12:10:00.000Z",
              connected_account_id: "ca_notion_123",
            },
          },
        ]),
      });

      const result = await runConnectNotionCommand({
        composio,
        apiKey: "secret",
        authConfigId: "ac_notion",
        openUrl: async () => false,
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Authorize: https://connect.composio.dev/notion");
    });
  });

  it("reports failed Composio authorization status", async () => {
    await withTempHome(async () => {
      const composio = new ComposioClient({
        apiKey: "secret",
        fetch: fakeFetch([
          {
            status: 201,
            body: {
              link_token: "link_123",
              redirect_url: "https://connect.composio.dev/notion",
              expires_at: "2026-05-15T12:10:00.000Z",
              connected_account_id: "ca_notion_123",
            },
          },
          {
            status: 200,
            body: {
              id: "ca_notion_123",
              status: "FAILED",
            },
          },
        ]),
      });

      const result = await runConnectNotionCommand({
        composio,
        apiKey: "secret",
        authConfigId: "ac_notion",
        openUrl: async () => true,
        sleep: async () => {},
      });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Notion connection ended with status FAILED");
    });
  });

  it("shows and disconnects a stored Notion connection", async () => {
    await withTempHome(async () => {
      const composio = new ComposioClient({
        apiKey: "secret",
        fetch: fakeFetch([
          {
            status: 201,
            body: {
              link_token: "link_123",
              redirect_url: "https://connect.composio.dev/notion",
              expires_at: "2026-05-15T12:10:00.000Z",
              connected_account_id: "ca_notion_123",
            },
          },
          {
            status: 200,
            body: {
              id: "ca_notion_123",
              status: "ACTIVE",
              updated_at: "2026-05-15T12:01:00.000Z",
            },
          },
        ]),
      });
      await runConnectNotionCommand({
        composio,
        apiKey: "secret",
        authConfigId: "ac_notion",
        wait: false,
        noOpen: true,
      });

      const status = await runConnectorsStatusCommand({ composio });
      expect(status.exitCode).toBe(0);
      expect(status.stdout).toContain("notion");
      expect(status.stdout).toContain("ACTIVE");

      const disconnected = await runDisconnectNotionCommand();
      expect(disconnected.exitCode).toBe(0);
      expect(disconnected.stdout).toBe("Notion disconnected\n");

      const after = await runConnectorsStatusCommand();
      expect(after.stdout).toBe("No connectors configured\n");
    });
  });

  it("does not call the Composio API when revoking a CLI-mode connection", async () => {
    await withTempHome(async () => {
      await runConnectNotionCommand({
        fromComposioCli: true,
        composioCli: new ComposioCli({
          run: async (args) => {
            if (args[0] === "whoami") return { email: "reverie@example.com" };
            return { connected_toolkits: ["notion"] };
          },
        }),
      });

      const disconnected = await runDisconnectNotionCommand({
        revoke: true,
        composio: {
          deleteConnectedAccount: async () => {
            throw new Error("should not revoke cli connection through API");
          },
        } as unknown as ComposioClient,
        json: true,
      });

      expect(disconnected.exitCode).toBe(0);
      expect(JSON.parse(disconnected.stdout)).toMatchObject({
        data: {
          connector: "notion",
          revoked: false,
        },
      });
    });
  });
});

function fakeFetch(
  responses: Array<{ status: number; body: unknown }>,
): typeof fetch {
  return (async () => {
    const response = responses.shift();
    if (response === undefined) throw new Error("unexpected fetch call");
    return new Response(JSON.stringify(response.body), {
      status: response.status,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
}
