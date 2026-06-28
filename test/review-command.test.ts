import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  runReviewAdd,
  runReviewApply,
  runReviewDecide,
  runReviewList,
  runReviewReopen,
  runReviewShow,
} from "../src/edges/cli/commands/review.js";
import { loadReviewFile } from "../src/stores/wiki-review/store.js";
import { makeRepo, scaffoldWiki, withTempHome } from "./helpers.js";

describe("review command", () => {
  it("adds a review item from markdown and derives a readable id", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "review-add");
      await scaffoldWiki(repo);

      const result = await runReviewAdd({
        cwd: repo,
        markdown:
          "# Which page should own source-conflict guidance?\n\n" +
          "Several pages discuss [[source-provenance]] and conflict handling.",
        now: new Date("2026-05-28T12:00:00.000Z"),
      });

      expect(result).toEqual({
        stdout: "added review item: which-page-should-own-source-conflict-guidance\n",
        stderr: "",
        exitCode: 0,
      });

      const path = join(repo, ".almanac", "review.yaml");
      const raw = await readFile(path, "utf8");
      expect(raw).toContain(".almanac/review.yaml");
      const file = await loadReviewFile(path);
      expect(file.items).toMatchObject([
        {
          id: "which-page-should-own-source-conflict-guidance",
          status: "open",
          summary: "Which page should own source-conflict guidance?",
          created_at: "2026-05-28T12:00:00.000Z",
          decided_at: null,
          applied_at: null,
        },
      ]);
    });
  });

  it("suffixes duplicate ids deterministically", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "review-duplicate");
      await scaffoldWiki(repo);

      await runReviewAdd({ cwd: repo, markdown: "# Same conflict" });
      const result = await runReviewAdd({ cwd: repo, markdown: "# Same conflict" });

      expect(result.stdout).toBe("added review item: same-conflict-2\n");
      const file = await loadReviewFile(join(repo, ".almanac", "review.yaml"));
      expect(file.items.map((item) => item.id)).toEqual(["same-conflict", "same-conflict-2"]);
    });
  });

  it("prefers the first markdown heading over preamble text for the summary", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "review-heading");
      await scaffoldWiki(repo);

      await runReviewAdd({
        cwd: repo,
        markdown: "This came from a long agent note.\n\n## Actual conflict title\n\nDetails.",
      });

      const file = await loadReviewFile(join(repo, ".almanac", "review.yaml"));
      expect(file.items[0]).toMatchObject({
        id: "actual-conflict-title",
        summary: "Actual conflict title",
      });
    });
  });

  it("lists open items by default and filters decided items", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "review-list");
      await scaffoldWiki(repo);

      await runReviewAdd({ cwd: repo, markdown: "# Open item" });
      await runReviewAdd({ cwd: repo, markdown: "# Decided item" });
      await runReviewDecide({
        cwd: repo,
        id: "decided-item",
        markdown: "Use [[source-provenance]] as the canonical page.",
      });

      const open = await runReviewList({ cwd: repo });
      expect(open.stdout).toBe("open    open-item  Open item\n");

      const decided = await runReviewList({ cwd: repo, status: "decided" });
      expect(decided.stdout).toBe("decided decided-item  Decided item\n");
    });
  });

  it("shows decisions and only applies decided items", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "review-apply");
      await scaffoldWiki(repo);

      await runReviewAdd({ cwd: repo, markdown: "# Source status conflict" });
      const blocked = await runReviewApply({
        cwd: repo,
        id: "source-status-conflict",
        markdown: "Updated source pages.",
      });
      expect(blocked).toMatchObject({
        stderr:
          "almanac: review apply requires a decided item (source-status-conflict is open)\n",
        exitCode: 1,
      });

      await runReviewDecide({
        cwd: repo,
        id: "source-status-conflict",
        markdown: "Do not add source status fields yet.",
        now: new Date("2026-05-28T13:00:00.000Z"),
      });
      const applied = await runReviewApply({
        cwd: repo,
        id: "source-status-conflict",
        markdown: "Updated [[source-provenance]] with the decision.",
        now: new Date("2026-05-28T14:00:00.000Z"),
      });
      expect(applied.stdout).toBe("applied review item: source-status-conflict\n");

      const shown = await runReviewShow({ cwd: repo, id: "source-status-conflict" });
      expect(shown.stdout).toContain("status: applied");
      expect(shown.stdout).toContain("Decision:\nDo not add source status fields yet.");
      expect(shown.stdout).toContain(
        "Application:\nUpdated [[source-provenance]] with the decision.",
      );

      const decideApplied = await runReviewDecide({
        cwd: repo,
        id: "source-status-conflict",
        markdown: "Change decision without reopening.",
      });
      expect(decideApplied).toMatchObject({
        stderr:
          "almanac: review decide cannot change an applied item; reopen source-status-conflict first\n",
        exitCode: 1,
      });
    });
  });

  it("reopens an item while preserving prior context", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "review-reopen");
      await scaffoldWiki(repo);

      await runReviewAdd({ cwd: repo, markdown: "# Canonical page is unclear" });
      await runReviewDecide({ cwd: repo, id: "canonical-page-is-unclear", markdown: "Use A." });
      await runReviewReopen({
        cwd: repo,
        id: "canonical-page-is-unclear",
        markdown: "A was archived; choose again.",
        now: new Date("2026-05-28T15:00:00.000Z"),
      });

      const shown = await runReviewShow({ cwd: repo, id: "canonical-page-is-unclear" });
      expect(shown.stdout).toContain("status: open");
      expect(shown.stdout).not.toContain("Decision:");
      expect(shown.stdout).toContain("Reopen note:\nA was archived; choose again.");
    });
  });

  it("rejects duplicate ids in hand-edited review yaml", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "review-duplicate-hand-edit");
      await scaffoldWiki(repo);
      await runReviewAdd({ cwd: repo, markdown: "# Duplicate id" });
      await runReviewAdd({ cwd: repo, markdown: "# Another item" });
      const path = join(repo, ".almanac", "review.yaml");
      const raw = await readFile(path, "utf8");
      await writeFile(path, raw.replace("another-item", "duplicate-id"), "utf8");

      await expect(loadReviewFile(path)).rejects.toThrow(
        'contains duplicate id "duplicate-id"',
      );
    });
  });

  it("returns a clear error when markdown is missing", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "review-empty");
      await scaffoldWiki(repo);

      const result = await runReviewAdd({ cwd: repo, markdown: "  " });

      expect(result).toEqual({
        stdout: "",
        stderr: "almanac: review add requires markdown text or piped stdin\n",
        exitCode: 1,
      });
    });
  });
});
