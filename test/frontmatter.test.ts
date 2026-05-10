import { describe, expect, it } from "vitest";

import { firstH1, parseFrontmatter } from "../src/indexer/frontmatter.js";

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
    expect(fm.body).toMatch(/^# Checkout Flow/m);
  });

  it("returns empty fields when frontmatter is absent", () => {
    const fm = parseFrontmatter("# Just a heading\n\nNo frontmatter.\n");
    expect(fm.topics).toEqual([]);
    expect(fm.files).toEqual([]);
    expect(fm.title).toBeUndefined();
    expect(fm.body).toMatch(/^# Just a heading/);
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
    // parseFrontmatter writes a warning to stderr on bad YAML. Suppress
    // it for the duration of this test so the test output stays clean.
    const origWrite = process.stderr.write.bind(process.stderr);
    process.stderr.write = ((): boolean => true) as typeof process.stderr.write;
    try {
      const fm = parseFrontmatter(
        `---
title: x
topics: [unclosed
---

body
`,
      );
      // Malformed — we can't extract fields, but the page is still indexable.
      expect(fm.topics).toEqual([]);
    } finally {
      process.stderr.write = origWrite;
    }
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
