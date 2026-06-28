import { readFile } from "node:fs/promises";

import { describe, expect, it, vi } from "vitest";

import { login } from "../src/cloud/auth.js";
import { CloudClient } from "../src/cloud/client.js";
import { credentialsPath } from "../src/cloud/config.js";
import type { ConversationTurnUpload } from "../src/cloud/types.js";
import { withTempHome } from "./helpers.js";

describe("CloudClient", () => {
  it("sends camelCase repository resolve requests", async () => {
    const requests: Request[] = [];
    const fetchImpl = vi.fn<typeof fetch>(async (input, init) => {
      requests.push(new Request(input, init));
      return jsonResponse({
        repoId: 123,
        accountId: 456,
        fullName: "AlmanacCode/codealmanac",
        defaultBranch: "main",
      });
    });

    const client = new CloudClient({
      baseUrl: "https://example.test",
      token: "cli-token",
      fetchImpl,
    });

    await client.resolveRepository("AlmanacCode/codealmanac");

    expect(requests[0]?.url).toBe("https://example.test/api/cli/repositories/resolve");
    expect(await requests[0]?.json()).toEqual({
      fullName: "AlmanacCode/codealmanac",
    });
    expect(requests[0]?.headers.get("authorization")).toBe("Bearer cli-token");
  });

  it("sends camelCase conversation turn uploads", async () => {
    const requests: Request[] = [];
    const fetchImpl = vi.fn<typeof fetch>(async (input, init) => {
      requests.push(new Request(input, init));
      return jsonResponse({
        sourceId: "source-id",
        turnId: "turn-id",
        routingStatus: "routable",
        messageCount: 1,
      });
    });
    const upload: ConversationTurnUpload = {
      provider: "codex",
      providerSessionId: "session-1",
      transcriptPathHash: "hash",
      firstCwd: "/repo",
      providerTurnId: "turn-1",
      branch: "feature",
      branchSource: "git_fallback",
      routingStatus: "routable",
      headSha: "abc123",
      startedAt: "2026-06-28T00:00:00.000Z",
      completedAt: "2026-06-28T00:01:00.000Z",
      messages: [{ role: "user", content: "hello", occurredAt: null }],
    };

    const client = new CloudClient({
      baseUrl: "https://example.test",
      token: "cli-token",
      fetchImpl,
    });

    await client.completeConversationTurn(42, upload);

    expect(requests[0]?.url).toBe(
      "https://example.test/api/cli/repositories/42/conversation-turns/complete",
    );
    expect(await requests[0]?.json()).toEqual(upload);
  });
});

describe("login", () => {
  it("stores the raw CLI token locally after polling issues it once", async () => {
    await withTempHome(async () => {
      const fetchImpl = vi.fn<typeof fetch>(async (input) => {
        const url = String(input);
        if (url.endsWith("/api/cli/auth/sessions")) {
          return jsonResponse({
            sessionId: "session-1",
            userCode: "ABCD-EFGH",
            verificationUrl: "https://example.test/cli-login?session=session-1&code=ABCD-EFGH",
            expiresAt: "2026-06-28T00:10:00.000Z",
            status: "pending",
            token: null,
          });
        }
        if (url.endsWith("/api/cli/auth/sessions/session-1/poll")) {
          return jsonResponse({
            sessionId: "session-1",
            userCode: "ABCD-EFGH",
            verificationUrl: "https://example.test/cli-login?session=session-1&code=ABCD-EFGH",
            expiresAt: "2026-06-28T00:10:00.000Z",
            status: "complete",
            token: "raw-token",
          });
        }
        if (url.endsWith("/api/cli/me")) {
          return jsonResponse({
            githubUserId: 1,
            githubLogin: "kushagra",
          });
        }
        throw new Error(`unexpected request ${url}`);
      });

      const pending: string[] = [];
      const openUrl = vi.fn<() => Promise<void>>(async () => {});
      const credentials = await login({
        baseUrl: "https://example.test",
        fetchImpl,
        openUrl,
        sleep: async () => {},
        onPending: (info) => pending.push(info.verificationUrl, info.userCode),
      });

      expect(credentials.token).toBe("raw-token");
      expect(credentials.githubLogin).toBe("kushagra");
      expect(pending).toEqual([
        "https://example.test/cli-login?session=session-1&code=ABCD-EFGH",
        "ABCD-EFGH",
      ]);
      expect(openUrl).toHaveBeenCalledWith(
        "https://example.test/cli-login?session=session-1&code=ABCD-EFGH",
      );
      const saved = JSON.parse(await readFile(credentialsPath(), "utf8")) as {
        token: string;
        githubLogin: string;
      };
      expect(saved).toMatchObject({
        token: "raw-token",
        githubLogin: "kushagra",
      });
    });
  });
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
