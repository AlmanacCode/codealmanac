import { UserFacingError } from "../../shared/user-facing-error.js";
import type { RegistryEntry } from "./types.js";

export function parseRegistryFile(
  raw: string,
  registryPath: string,
): RegistryEntry[] {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new UserFacingError(
      `registry at ${registryPath} is not valid JSON: ${message}`,
      { data: { path: registryPath } },
    );
  }

  if (!Array.isArray(parsed)) {
    throw new UserFacingError(
      `registry at ${registryPath} must be a JSON array`,
      { data: { path: registryPath } },
    );
  }

  return parsed.map((item, index) =>
    parseRegistryEntry(item, index, registryPath)
  );
}

function parseRegistryEntry(
  item: unknown,
  index: number,
  registryPath: string,
): RegistryEntry {
  if (typeof item !== "object" || item === null) {
    throw new UserFacingError(
      `registry entry ${index} is not an object`,
      { data: { path: registryPath, index } },
    );
  }
  const entry = item as Record<string, unknown>;
  const name = typeof entry.name === "string" ? entry.name : "";
  const path = typeof entry.path === "string" ? entry.path : "";
  if (name.length === 0) {
    throw new UserFacingError(
      `registry entry ${index} is missing a non-empty "name"`,
      { data: { path: registryPath, index, field: "name" } },
    );
  }
  if (path.length === 0) {
    throw new UserFacingError(
      `registry entry ${index} is missing a non-empty "path"`,
      { data: { path: registryPath, index, field: "path" } },
    );
  }
  return {
    name,
    description: typeof entry.description === "string" ? entry.description : "",
    path,
    registered_at:
      typeof entry.registered_at === "string" ? entry.registered_at : "",
  };
}
