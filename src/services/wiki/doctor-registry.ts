import { findEntry } from "../../stores/wiki-registry/index.js";
import type { WikiDoctorCheck } from "./doctor-types.js";

export async function describeWikiRegistry(
  repoRoot: string,
): Promise<WikiDoctorCheck> {
  try {
    const entry = await findEntry({ path: repoRoot });
    if (entry !== null) {
      return {
        status: "ok",
        key: "wiki.registered",
        message: `registered as '${entry.name}'`,
      };
    }
    return {
      status: "info",
      key: "wiki.registered",
      message: "not yet registered (will register on first command)",
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      status: "problem",
      key: "wiki.registered",
      message: `could not read registry: ${msg}`,
      fix: "inspect ~/.almanac/registry.json; remove or fix the malformed entry",
    };
  }
}
