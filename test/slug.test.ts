import { describe, expect, it } from "vitest";

import { toKebabCase } from "../src/slug.js";

describe("toKebabCase", () => {
  it("lowercases and hyphenates", () => {
    expect(toKebabCase("MyRepo")).toBe("myrepo");
    expect(toKebabCase("My Repo")).toBe("my-repo");
    expect(toKebabCase("My_Repo_Name")).toBe("my-repo-name");
    expect(toKebabCase("my.repo.name")).toBe("my-repo-name");
    expect(toKebabCase("  leading-trailing  ")).toBe("leading-trailing");
    expect(toKebabCase("---weird---")).toBe("weird");
    expect(toKebabCase("a__b--c")).toBe("a-b-c");
    expect(toKebabCase("")).toBe("");
  });
});
