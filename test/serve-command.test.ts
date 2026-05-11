import { describe, expect, it } from "vitest";

import {
  buildQueuedRunRecord,
  runRecordPath,
  writeRunRecord,
} from "../src/process/index.js";
import { startViewerServer } from "../src/viewer/server.js";
import { makeRepo, scaffoldWiki, withTempHome, writePage } from "./helpers.js";

describe("viewer server", () => {
  it("serves static UI and JSON API routes", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      await writePage(
        repo,
        "capture-flow",
        "---\ntitle: Capture Flow\ntopics: [flows]\n---\n\n# Capture Flow\n\nBody.\n",
      );
      const record = buildQueuedRunRecord({
        runId: "run_20260510123000_server",
        repoRoot: repo,
        queuedAt: new Date("2026-05-10T12:30:00.000Z"),
        spec: {
          provider: { id: "claude" },
          cwd: repo,
          prompt: "absorb",
          metadata: { operation: "absorb" },
        },
      });
      await writeRunRecord(runRecordPath(repo, record.id), record);

      const server = await startViewerServer({ repoRoot: repo, port: 0 });
      try {
        const html = await fetch(server.url).then((r) => r.text());
        expect(html).toContain("Almanac");

        const overview = await fetch(`${server.url}/api/overview`).then((r) => r.json()) as {
          pageCount: number;
        };
        expect(overview.pageCount).toBe(1);

        const page = await fetch(`${server.url}/api/page/capture-flow`).then((r) => r.json()) as {
          title: string;
          body: string;
        };
        expect(page.title).toBe("Capture Flow");
        expect(page.body).toContain("# Capture Flow");

        const suggest = await fetch(`${server.url}/api/suggest?q=capture`).then((r) => r.json()) as {
          pages: Array<{ slug: string }>;
        };
        expect(suggest.pages.map((p) => p.slug)).toEqual(["capture-flow"]);

        const jobs = await fetch(`${server.url}/api/jobs`).then((r) => r.json()) as {
          runs: Array<{ id: string }>;
        };
        expect(jobs.runs.map((run) => run.id)).toEqual([record.id]);

        const job = await fetch(`${server.url}/api/jobs/${record.id}`).then((r) => r.json()) as {
          run: { id: string };
          events: unknown[];
        };
        expect(job.run.id).toBe(record.id);
        expect(job.events).toEqual([]);
      } finally {
        await server.close();
      }
    });
  });
});
