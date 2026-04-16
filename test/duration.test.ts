import { describe, expect, it } from "vitest";

import { parseDuration } from "../src/indexer/duration.js";

describe("parseDuration", () => {
  it("parses minutes", () => {
    expect(parseDuration("5m")).toBe(5 * 60);
  });

  it("parses hours", () => {
    expect(parseDuration("12h")).toBe(12 * 3600);
  });

  it("parses days", () => {
    expect(parseDuration("30d")).toBe(30 * 86400);
  });

  it("parses weeks", () => {
    expect(parseDuration("2w")).toBe(2 * 7 * 86400);
  });

  it("rejects missing unit", () => {
    expect(() => parseDuration("30")).toThrow(/invalid duration/);
  });

  it("rejects unknown unit", () => {
    expect(() => parseDuration("30y")).toThrow(/invalid duration/);
  });

  it("rejects spaces", () => {
    expect(() => parseDuration("30 d")).toThrow(/invalid duration/);
  });

  it("rejects empty input", () => {
    expect(() => parseDuration("")).toThrow(/invalid duration/);
  });

  it("tolerates surrounding whitespace", () => {
    expect(parseDuration("  30d  ")).toBe(30 * 86400);
  });
});
