import { formatShowRecords } from "./format.js";
import type { ShowCommandOutput, ShowOptions, ShowRecord } from "./types.js";

export function renderShowMissingInput(): ShowCommandOutput {
  return {
    stdout: "",
    stderr: "almanac: show requires a slug (or --stdin)\n",
    exitCode: 1,
  };
}

export function renderShowResult(args: {
  records: ShowRecord[];
  missing: string[];
  options: ShowOptions;
}): ShowCommandOutput {
  return {
    stdout: formatShowRecords(args.records, args.options),
    stderr: renderMissingPages(args.missing),
    exitCode: args.missing.length > 0 ? 1 : 0,
  };
}

function renderMissingPages(slugs: string[]): string {
  return slugs.map((slug) => `almanac: no such page "${slug}"\n`).join("");
}
