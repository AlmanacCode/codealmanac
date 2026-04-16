/**
 * Tiny semver comparator for update-version checks. We do NOT take a
 * dependency on `semver` — we only need a subset (compare two
 * well-formed `x.y.z` strings, optionally with a pre-release tag), and
 * adding a 400KB install for six lines of logic isn't a good trade.
 *
 * What we handle:
 *   - Numeric `major.minor.patch` with or without a `-pre` tag.
 *   - Missing parts default to 0 (`1.2` → `1.2.0`).
 *   - Leading `v` is stripped.
 *
 * What we don't handle:
 *   - Build metadata (`+sha.abcd`) — ignored.
 *   - Pre-release precedence rules beyond "tagged < untagged at same
 *     numeric triple". Good enough for codealmanac's linear release
 *     cadence; if we ever publish `-rc.1` vs `-rc.2` and care which
 *     comes first, revisit.
 */

interface Parsed {
  major: number;
  minor: number;
  patch: number;
  /** Empty string = no pre-release (counts as "higher" than a pre-release at the same triple). */
  pre: string;
}

function parse(v: string): Parsed | null {
  const trimmed = v.trim().replace(/^v/i, "");
  // Strip build metadata (everything from the first `+`).
  const noBuild = trimmed.split("+")[0] ?? "";
  // Split off pre-release tag.
  const dashAt = noBuild.indexOf("-");
  const core = dashAt === -1 ? noBuild : noBuild.slice(0, dashAt);
  const pre = dashAt === -1 ? "" : noBuild.slice(dashAt + 1);

  const parts = core.split(".").map((p) => Number.parseInt(p, 10));
  if (parts.length === 0 || parts.some((n) => !Number.isFinite(n) || n < 0)) {
    return null;
  }
  return {
    major: parts[0] ?? 0,
    minor: parts[1] ?? 0,
    patch: parts[2] ?? 0,
    pre,
  };
}

/**
 * Return `true` iff `latest` > `installed`. Returns `false` on unparseable
 * input rather than throwing — a bad version string must not be able to
 * crash the CLI's every-command banner path.
 */
export function isNewer(latest: string, installed: string): boolean {
  const a = parse(latest);
  const b = parse(installed);
  if (a === null || b === null) return false;

  if (a.major !== b.major) return a.major > b.major;
  if (a.minor !== b.minor) return a.minor > b.minor;
  if (a.patch !== b.patch) return a.patch > b.patch;

  // Same numeric triple. Empty pre-release beats a tagged pre-release
  // (1.2.3 > 1.2.3-rc.1). Two tagged pre-releases compare lexically.
  if (a.pre === b.pre) return false;
  if (a.pre === "" && b.pre !== "") return true;
  if (a.pre !== "" && b.pre === "") return false;
  return a.pre > b.pre;
}
