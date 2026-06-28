import { describe, expect, it } from "vitest";

import { firstH1, parseFrontmatter } from "../src/stores/wiki/indexer/frontmatter.js";

describe("parseFrontmatter", () => {
  it("parses a normal frontmatter block", () => {
    const fm = parseFrontmatter(
      `---
title: Checkout Flow
summary: Checkout decisions and invariants for future agents.
topics: [checkout, flows]
files:
  - src/checkout/handler.ts
  - src/checkout/
---

# Checkout Flow

Body goes here.
`,
    );
    expect(fm.title).toBe("Checkout Flow");
    expect(fm.summary).toBe("Checkout decisions and invariants for future agents.");
    expect(fm.topics).toEqual(["checkout", "flows"]);
    expect(fm.files).toEqual(["src/checkout/handler.ts", "src/checkout/"]);
    expect(fm.sources).toEqual([]);
    expect(fm.legacySourceStrings).toEqual([]);
    expect(fm.body).toMatch(/^# Checkout Flow/m);
  });

  it("returns empty fields when frontmatter is absent", () => {
    const fm = parseFrontmatter("# Just a heading\n\nNo frontmatter.\n");
    expect(fm.topics).toEqual([]);
    expect(fm.files).toEqual([]);
    expect(fm.sources).toEqual([]);
    expect(fm.legacySourceStrings).toEqual([]);
    expect(fm.title).toBeUndefined();
    expect(fm.body).toMatch(/^# Just a heading/);
  });

  it("parses structured sources and legacy source strings", () => {
    const fm = parseFrontmatter(
      `---
title: Absorb
sources:
  - id: absorb-command
    type: file
    path: src/edges/cli/commands/operations.ts
    note: Starts absorb.
  - id: sdk-docs
    type: web
    url: https://example.com/docs
    title: SDK Docs
    retrieved_at: 2026-05-28
    note: External behavior.
  - id: bug-report
    type: issue
    number: 42
    note: User-reported regression.
  - https://legacy.example.com/docs
files:
  - src/legacy.ts
---

Body.
`,
    );

    expect(fm.sources).toEqual([
      {
        id: "absorb-command",
        type: "file",
        path: "src/edges/cli/commands/operations.ts",
        note: "Starts absorb.",
      },
      {
        id: "sdk-docs",
        type: "web",
        url: "https://example.com/docs",
        title: "SDK Docs",
        retrieved_at: "2026-05-28",
        note: "External behavior.",
      },
      {
        id: "bug-report",
        type: "issue",
        number: "42",
        note: "User-reported regression.",
      },
    ]);
    expect(fm.files).toEqual(["src/legacy.ts"]);
    expect(fm.legacySourceStrings).toEqual(["https://legacy.example.com/docs"]);
  });

  it("ignores malformed structured sources", () => {
    const fm = parseFrontmatter(
      `---
sources:
  - type: file
    path: src/no-id.ts
  - id: no-path
    type: file
  - id: manual
    type: manual
    note: Human-provided evidence.
---

Body.
`,
    );

    expect(fm.sources).toEqual([
      {
        id: "manual",
        type: "manual",
        note: "Human-provided evidence.",
      },
    ]);
  });

  it("tolerates extra frontmatter fields", () => {
    const fm = parseFrontmatter(
      `---
title: x
topics: [a]
some_future_field: 42
arbitrary:
  nested: value
---

body
`,
    );
    expect(fm.title).toBe("x");
    expect(fm.topics).toEqual(["a"]);
  });

  it("recovers from malformed YAML by returning empty fields", () => {
    const warnings: string[] = [];
    const fm = parseFrontmatter(
      `---
title: x
topics: [unclosed
---

body
`,
      { warnings: (message) => warnings.push(message) },
    );
    // Malformed — we can't extract fields, but the page is still indexable.
    expect(fm.topics).toEqual([]);
    expect(warnings.join("\n")).toMatch(/malformed frontmatter/);
  });

  it("coerces archived_at from a YAML date", () => {
    const fm = parseFrontmatter(
      `---
title: old
archived_at: 2026-04-15
---
`,
    );
    expect(fm.archived_at).not.toBeNull();
    const asDate = new Date((fm.archived_at ?? 0) * 1000);
    expect(asDate.getUTCFullYear()).toBe(2026);
    expect(asDate.getUTCMonth()).toBe(3); // April
    expect(asDate.getUTCDate()).toBe(15);
  });

  it("coerces archived_at from an ISO string", () => {
    const fm = parseFrontmatter(
      `---
archived_at: "2026-04-15T12:00:00Z"
---
`,
    );
    expect(fm.archived_at).not.toBeNull();
  });

  it("leaves archived_at null for garbage input", () => {
    const fm = parseFrontmatter(
      `---
archived_at: "not a date"
---
`,
    );
    expect(fm.archived_at).toBeNull();
  });

  it("ignores a --- that isn't on line 1", () => {
    const fm = parseFrontmatter("# Heading\n\n---\n\nSection break.\n");
    expect(fm.topics).toEqual([]);
    expect(fm.body).toMatch(/Section break/);
  });

  it("captures superseded_by and supersedes as strings", () => {
    const fm = parseFrontmatter(
      `---
title: old
superseded_by: stripe-async
---
`,
    );
    expect(fm.superseded_by).toBe("stripe-async");
  });
});

describe("firstH1", () => {
  it("returns the first H1", () => {
    expect(firstH1("# Hello\n\nbody")).toBe("Hello");
  });

  it("returns undefined when there is no H1", () => {
    expect(firstH1("## Only H2 here")).toBeUndefined();
  });

  it("strips trailing hashes and whitespace", () => {
    expect(firstH1("#   Title   ##")).toBe("Title");
  });
});
