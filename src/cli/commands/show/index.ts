import {
  readWikiPages,
  type WikiPageView,
} from "../../../services/wiki/page-view.js";

import { renderShowMissingInput, renderShowResult } from "./render.js";
import { collectShowSlugs } from "./slugs.js";
import type { ShowCommandOutput, ShowOptions, ShowRecord } from "./types.js";

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
    return renderShowMissingInput();
  }

  const { records, missing } = await readWikiPages({
    cwd: options.cwd,
    wiki: options.wiki,
    slugs,
  });

  return renderShowResult({
    records: records.map(showRecordFromWikiService),
    missing,
    options,
  });
}

function showRecordFromWikiService(record: WikiPageView): ShowRecord {
  return {
    slug: record.slug,
    title: record.title,
    summary: record.summary,
    file_path: record.file_path,
    updated_at: record.updated_at,
    archived_at: record.archived_at,
    superseded_by: record.superseded_by,
    supersedes: record.supersedes,
    topics: record.topics,
    file_refs: record.file_refs.map((file) => ({
      path: file.path,
      is_dir: file.is_dir,
    })),
    sources: record.sources.map((source) => ({
      id: source.id,
      type: source.type,
      target: source.target,
      title: source.title,
      retrieved_at: source.retrieved_at,
      note: source.note,
      legacy: source.legacy,
    })),
    wikilinks_out: record.wikilinks_out,
    wikilinks_in: record.wikilinks_in,
    cross_wiki_links: record.cross_wiki_links.map((link) => ({
      wiki: link.wiki,
      target: link.target,
    })),
    body: record.body,
  };
}
