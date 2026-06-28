import type {
  RegistryEntry,
  RegistryPathLookupOptions,
} from "./types.js";

export function findRegistryEntry(
  entries: RegistryEntry[],
  params: {
    name?: string;
    path?: string;
  },
  options: RegistryPathLookupOptions = {},
): RegistryEntry | null {
  const pathEquals = options.pathEquals ?? exactPathEquality;
  for (const entry of entries) {
    if (params.name !== undefined && entry.name === params.name) return entry;
    if (params.path !== undefined && pathEquals(entry.path, params.path)) {
      return entry;
    }
  }
  return null;
}

export function exactPathEquality(a: string, b: string): boolean {
  return a === b;
}
