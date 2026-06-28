import type { PathEquality } from "../shared/path-equality.js";

export const pathsEqualOnCurrentPlatform: PathEquality = (a, b) => {
  return isCaseInsensitivePathPlatform(process.platform)
    ? a.toLowerCase() === b.toLowerCase()
    : a === b;
};

export function isCaseInsensitivePathPlatform(
  platform: NodeJS.Platform,
): boolean {
  return platform === "darwin" || platform === "win32";
}
