import { afterEach, describe, expect, it, vi } from "vitest";

const originalNoColor = process.env.NO_COLOR;
const stdoutIsTTY = process.stdout.isTTY;

afterEach(() => {
  vi.resetModules();
  if (originalNoColor === undefined) {
    delete process.env.NO_COLOR;
  } else {
    process.env.NO_COLOR = originalNoColor;
  }
  Object.defineProperty(process.stdout, "isTTY", {
    value: stdoutIsTTY,
    configurable: true,
  });
});

describe("ansi", () => {
  it("treats NO_COLOR as presence-based, even when set to an empty string", async () => {
    process.env.NO_COLOR = "";
    Object.defineProperty(process.stdout, "isTTY", {
      value: true,
      configurable: true,
    });

    vi.resetModules();
    const ansi = await import("../src/ansi.js");

    expect(ansi.BOLD).toBe("");
    expect(ansi.BLUE).toBe("");
    expect(ansi.RST).toBe("");
  });

  it("still enables colors when stdout is a TTY and NO_COLOR is absent", async () => {
    delete process.env.NO_COLOR;
    Object.defineProperty(process.stdout, "isTTY", {
      value: true,
      configurable: true,
    });

    vi.resetModules();
    const ansi = await import("../src/ansi.js");

    expect(ansi.BOLD).not.toBe("");
    expect(ansi.BLUE).not.toBe("");
    expect(ansi.RST).not.toBe("");
  });
});
