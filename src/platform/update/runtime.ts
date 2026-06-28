import { checkForUpdate } from "./check.js";
import {
  installLatestPackage,
  type InstallLatestPackageResult,
} from "./install.js";
import { readInstalledVersion } from "./version.js";
import type {
  UpdateInstallResult,
  UpdateRuntime,
} from "../../services/update/index.js";

export function createPlatformUpdateRuntime(): UpdateRuntime {
  return {
    readInstalledVersion,
    checkForUpdate,
    async installLatestPackage() {
      return updateInstallResultFromPlatform(await installLatestPackage());
    },
  };
}

function updateInstallResultFromPlatform(
  result: InstallLatestPackageResult,
): UpdateInstallResult {
  return {
    output: result.stdout,
    errorOutput: result.stderr,
    code: result.exitCode,
  };
}

