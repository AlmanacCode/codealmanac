import { mkdir } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  formatMissingPinnedNodeMessage,
  installRuntimePath,
  readInstallRuntime,
  readInstallRuntimeSync,
  sameExecutablePath,
  writeInstallRuntime,
} from "../src/install/launcher-runtime.js";
import { withTempHome } from "./helpers.js";

describe("install launcher runtime", () => {
  it("records the install-time node executable beside the built launcher", async () => {
    await withTempHome(async (home) => {
      const packageRoot = join(home, "pkg");
      await mkdir(packageRoot, { recursive: true });

      await writeInstallRuntime({
        packageRoot,
        nodePath: "/opt/node/bin/node",
        nodeVersion: "v24.15.0",
        nodeAbi: "137",
      });

      await expect(readInstallRuntime(packageRoot)).resolves.toEqual({
        nodePath: "/opt/node/bin/node",
        nodeVersion: "v24.15.0",
        nodeAbi: "137",
      });
      expect(readInstallRuntimeSync(packageRoot)).toEqual({
        nodePath: "/opt/node/bin/node",
        nodeVersion: "v24.15.0",
        nodeAbi: "137",
      });
      expect(installRuntimePath(packageRoot)).toBe(
        join(packageRoot, "install-runtime.json"),
      );
    });
  });

  it("formats the repair message when the pinned node path is gone", () => {
    expect(
      formatMissingPinnedNodeMessage({
        nodePath: "/tmp/codealmanac-no-such-node",
        nodeVersion: "v24.15.0",
        nodeAbi: "137",
      }),
    ).toContain("npm install -g codealmanac@latest");
  });

  it("compares executable paths after resolution", () => {
    expect(sameExecutablePath("/tmp/../tmp/node", "/tmp/node")).toBe(true);
  });
});
