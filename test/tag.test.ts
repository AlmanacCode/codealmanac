import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { runTag, runUntag } from "../src/commands/tag.js";
import { runIndexer } from "../src/indexer/index.js";
import { topicsYamlPath } from "../src/topics/paths.js";
import { loadTopicsFile } from "../src/topics/yaml.js";
import {
  makeRepo,
  scaffoldWiki,
  withTempHome,
  writePage,
} from "./helpers.js";

describe("almanac tag / untag", () => {
  it("adds topics to a page's frontmatter", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      await writePage(
        repo,
        "doc",
        "---\ntitle: Doc\ntopics: [existing]\n---\n\n# Doc\n\nBody text here.\n",
      );
      await runIndexer({ repoRoot: repo });

      const result = await runTag({
        cwd: repo,
        page: "doc",
        topics: ["auth", "jwt"],
      });
      expect(result.exitCode).toBe(0);

      const page = await readFile(
        join(repo, ".almanac", "pages", "doc.md"),
        "utf8",
      );
      expect(page).toMatch(/topics: \[existing, auth, jwt\]/);
    });
  });

  it("auto-creates missing topics in topics.yaml", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      await writePage(repo, "doc", "---\ntopics: []\n---\n\nbody content.\n");
      await runIndexer({ repoRoot: repo });

      await runTag({
        cwd: repo,
        page: "doc",
        topics: ["brand-new"],
      });
      const file = await loadTopicsFile(topicsYamlPath(repo));
      const t = file.topics.find((x) => x.slug === "brand-new");
      expect(t).toBeDefined();
      expect(t?.title).toBe("Brand New");
    });
  });

  it("preserves the page body and other frontmatter fields byte-exact", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      const body =
        "# Doc\n\nMulti-paragraph body.\n\nWith `inline code` and [[link]].\n\n- list item\n- another\n";
      const original =
        "---\ntitle: Doc\ntopics: [one]\nfiles:\n  - src/a.ts\n---\n" + body;
      await writePage(repo, "doc", original);
      await runIndexer({ repoRoot: repo });

      await runTag({
        cwd: repo,
        page: "doc",
        topics: ["two"],
      });
      const after = await readFile(
        join(repo, ".almanac", "pages", "doc.md"),
        "utf8",
      );

      // Body is bit-identical.
      const bodyIdx = after.indexOf("# Doc");
      expect(bodyIdx).toBeGreaterThan(0);
      expect(after.slice(bodyIdx)).toBe(body);

      // `title:` and `files:` keys survived.
      expect(after).toMatch(/title: Doc/);
      expect(after).toMatch(/files:\n\s+- src\/a\.ts/);
    });
  });

  it("is idempotent — retagging with existing topics is a no-op", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      await writePage(
        repo,
        "doc",
        "---\ntopics: [already]\n---\n\nbody content.\n",
      );
      await runIndexer({ repoRoot: repo });

      const before = await readFile(
        join(repo, ".almanac", "pages", "doc.md"),
        "utf8",
      );
      const result = await runTag({
        cwd: repo,
        page: "doc",
        topics: ["already"],
      });
      expect(result.exitCode).toBe(0);
      const after = await readFile(
        join(repo, ".almanac", "pages", "doc.md"),
        "utf8",
      );
      expect(after).toBe(before);
    });
  });

  it("tag --stdin tags every slug from stdin", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      await writePage(repo, "a", "---\ntopics: []\n---\n\nbody a.\n");
      await writePage(repo, "b", "---\ntopics: []\n---\n\nbody b.\n");
      await runIndexer({ repoRoot: repo });

      const result = await runTag({
        cwd: repo,
        topics: ["arch"],
        stdin: true,
        stdinInput: "a\nb\n",
      });
      expect(result.exitCode).toBe(0);

      const a = await readFile(
        join(repo, ".almanac", "pages", "a.md"),
        "utf8",
      );
      const b = await readFile(
        join(repo, ".almanac", "pages", "b.md"),
        "utf8",
      );
      expect(a).toMatch(/topics: \[arch\]/);
      expect(b).toMatch(/topics: \[arch\]/);
    });
  });

  it("untag removes a topic without touching the body", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      const body = "# Doc\n\nBody here.\n";
      await writePage(
        repo,
        "doc",
        "---\ntopics: [a, b, c]\n---\n" + body,
      );
      await runIndexer({ repoRoot: repo });

      const result = await runUntag({
        cwd: repo,
        page: "doc",
        topic: "b",
      });
      expect(result.exitCode).toBe(0);

      const after = await readFile(
        join(repo, ".almanac", "pages", "doc.md"),
        "utf8",
      );
      expect(after).toMatch(/topics: \[a, c\]/);
      // Body preserved.
      expect(after).toMatch(/# Doc\n\nBody here\./);
    });
  });

  it("untag on a topic the page doesn't have is a no-op", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      const raw = "---\ntopics: [a]\n---\n# Doc\n\nBody.\n";
      await writePage(repo, "doc", raw);
      await runIndexer({ repoRoot: repo });

      const result = await runUntag({
        cwd: repo,
        page: "doc",
        topic: "not-there",
      });
      expect(result.exitCode).toBe(0);
      const after = await readFile(
        join(repo, ".almanac", "pages", "doc.md"),
        "utf8",
      );
      expect(after).toBe(raw);
    });
  });

  it("errors when the page slug is unknown", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      await runIndexer({ repoRoot: repo });

      const result = await runTag({
        cwd: repo,
        page: "nonexistent",
        topics: ["auth"],
      });
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toMatch(/no such page/);
    });
  });

  it("preserves interleaved comments on a block-style topics list", async () => {
    // Regression: the block-sequence scanner used to break on the first
    // non-dash line, which dropped `# keep me` AND any `- entry` after
    // it on the next tag/untag. The scanner now skips comments/blanks
    // and re-emits them below the new flow-style `topics:` line.
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      await writePage(
        repo,
        "doc",
        [
          "---",
          "title: Doc",
          "topics:",
          "  - auth",
          "  # keep me",
          "  - jwt",
          "---",
          "",
          "Body.",
          "",
        ].join("\n"),
      );
      await runIndexer({ repoRoot: repo });

      const result = await runTag({
        cwd: repo,
        page: "doc",
        topics: ["another"],
      });
      expect(result.exitCode).toBe(0);
      const after = await readFile(
        join(repo, ".almanac", "pages", "doc.md"),
        "utf8",
      );
      // Flow-style replacement on the key line.
      expect(after).toMatch(/topics: \[auth, jwt, another\]/);
      // Interleaved comment still present.
      expect(after).toContain("# keep me");
      // Body preserved.
      expect(after).toMatch(/^Body\.$/m);
    });
  });

  it("preserves CRLF line endings end-to-end", async () => {
    // Regression: `fmLines.split(/\r?\n/)` stripped the original endings
    // and rewrite joined with `\n`, producing mixed-EOL frontmatter on
    // a CRLF-authored file. Now the splitter sniffs the dominant EOL
    // and rewrite re-emits with the same separator.
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      const original =
        "---\r\ntitle: Doc\r\ntopics: [auth]\r\n---\r\nBody line.\r\n";
      await writePage(repo, "doc", original);
      await runIndexer({ repoRoot: repo });

      const result = await runTag({
        cwd: repo,
        page: "doc",
        topics: ["foo"],
      });
      expect(result.exitCode).toBe(0);

      const after = await readFile(
        join(repo, ".almanac", "pages", "doc.md"),
        "utf8",
      );
      // Every frontmatter newline is still CRLF. Body bytes are
      // untouched regardless of EOL (body-byte-preservation guarantee).
      const fmMatch = after.match(/^(---[\s\S]*?---)(\r?\n)?/);
      expect(fmMatch).not.toBeNull();
      const fmBlock = fmMatch?.[0] ?? "";
      expect(fmBlock.includes("\r\n")).toBe(true);
      expect(fmBlock.match(/(?<!\r)\n/g)).toBeNull();
      expect(after).toMatch(/topics: \[auth, foo\]/);
      expect(after.endsWith("Body line.\r\n")).toBe(true);
    });
  });

  it("summarizes only the newly-added topics, not the full request", async () => {
    // Regression: `tag doc existing,new` used to print
    // "tagged doc: existing, new" even though `existing` was already
    // there — misleading in commit diffs. Now it's the delta only.
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      await writePage(
        repo,
        "doc",
        "---\ntopics: [existing]\n---\n\nbody.\n",
      );
      await runIndexer({ repoRoot: repo });

      const result = await runTag({
        cwd: repo,
        page: "doc",
        topics: ["existing", "brand-new"],
      });
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("brand-new");
      // The already-present topic shouldn't show up in the summary.
      expect(result.stdout).not.toMatch(/tagged doc:.*existing.*brand-new/);
    });
  });

  // Body-byte-preservation matrix. Each combination exercises a different
  // line-ending + trailing-newline + list-style variant; all of them must
  // leave the body (everything after the closing `---`) byte-identical.
  const bodyMatrix = [
    {
      name: "LF, flow style, trailing newline",
      eol: "\n",
      topicsLine: "topics: [one]",
      trailingNewline: true,
    },
    {
      name: "CRLF, flow style, trailing newline",
      eol: "\r\n",
      topicsLine: "topics: [one]",
      trailingNewline: true,
    },
    {
      name: "LF, block style, no trailing newline",
      eol: "\n",
      topicsLine: "topics:\n  - one",
      trailingNewline: false,
    },
    {
      name: "CRLF, block style, trailing newline",
      eol: "\r\n",
      topicsLine: "topics:\r\n  - one",
      trailingNewline: true,
    },
    {
      name: "Mixed EOL (CRLF frontmatter, LF body), trailing newline",
      eol: "\r\n",
      topicsLine: "topics: [one]",
      trailingNewline: true,
      // Body uses LF regardless of frontmatter EOL.
      bodyEolOverride: "\n",
    },
  ];
  for (const variant of bodyMatrix) {
    it(`preserves body bytes (${variant.name})`, async () => {
      await withTempHome(async (home) => {
        const repo = await makeRepo(home, "r");
        await scaffoldWiki(repo);
        const bodyEol = variant.bodyEolOverride ?? variant.eol;
        const body =
          [
            "# Doc",
            "",
            "Paragraph with `code` and [[link]].",
            "",
            "- list item",
            "- another",
          ].join(bodyEol) + (variant.trailingNewline ? bodyEol : "");
        const original =
          [`---`, `title: Doc`, variant.topicsLine, `---`].join(variant.eol) +
          variant.eol +
          body;
        await writePage(repo, "doc", original);
        await runIndexer({ repoRoot: repo });

        await runTag({ cwd: repo, page: "doc", topics: ["two"] });
        const after = await readFile(
          join(repo, ".almanac", "pages", "doc.md"),
          "utf8",
        );

        // Body (after the closing fence) is byte-identical to original.
        // We split at the second `---` line end.
        const findCloser = (s: string): number => {
          const re = /(\r?\n)---(\r?\n|$)/;
          const m = s.match(re);
          if (m === null || m.index === undefined) return -1;
          return m.index + (m[0]?.length ?? 0);
        };
        const origBodyStart = findCloser(original);
        const afterBodyStart = findCloser(after);
        expect(origBodyStart).toBeGreaterThan(-1);
        expect(afterBodyStart).toBeGreaterThan(-1);
        expect(after.slice(afterBodyStart)).toBe(
          original.slice(origBodyStart),
        );
        // And the new topic landed.
        expect(after).toMatch(/two/);
      });
    });
  }
});
