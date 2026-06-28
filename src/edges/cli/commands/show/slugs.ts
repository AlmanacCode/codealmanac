import type { ShowOptions } from "./types.js";

export function collectShowSlugs(options: ShowOptions): string[] {
  if (options.stdin === true && options.stdinInput !== undefined) {
    return options.stdinInput
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }
  if (options.slug !== undefined && options.slug.length > 0) {
    return [options.slug];
  }
  return [];
}
