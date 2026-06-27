import { readWikiPages } from "../../../services/wiki/page-view.js";

import { formatShowRecords } from "./format.js";
import { collectShowSlugs } from "./slugs.js";
import type { ShowCommandOutput, ShowOptions } from "./types.js";

export type {
  FieldName,
  ShowCommandOutput,
  ShowOptions,
  ShowRecord,
} from "./types.js";

export async function runShow(
  options: ShowOptions,
): Promise<ShowCommandOutput> {
  const slugs = collectShowSlugs(options);
  if (slugs.length === 0) {
    return {
      stdout: "",
      stderr: "almanac: show requires a slug (or --stdin)\n",
      exitCode: 1,
    };
  }

  const { records, missing } = await readWikiPages({
    cwd: options.cwd,
    wiki: options.wiki,
    slugs,
  });

  const stderr = missing
    .map((s) => `almanac: no such page "${s}"\n`)
    .join("");

  return {
    stdout: formatShowRecords(records, options),
    stderr,
    exitCode: missing.length > 0 ? 1 : 0,
  };
}
