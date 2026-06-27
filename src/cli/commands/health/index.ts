import {
  checkWikiHealth,
  DEFAULT_STALE_SECONDS,
} from "../../../services/wiki/health.js";
import { parseDuration } from "../../../shared/duration.js";
import {
  renderHealthReport,
  type HealthCommandOutput,
} from "./render.js";

export interface HealthOptions {
  cwd: string;
  wiki?: string;
  topic?: string;
  stale?: string;
  stdin?: boolean;
  stdinInput?: string;
  json?: boolean;
  color?: boolean;
}

export async function runHealth(
  options: HealthOptions,
): Promise<HealthCommandOutput> {
  const staleSeconds = options.stale !== undefined
    ? parseDuration(options.stale)
    : DEFAULT_STALE_SECONDS;
  const slugs = stdinSlugs(options);
  const report = await checkWikiHealth({
    cwd: options.cwd,
    wiki: options.wiki,
    topic: options.topic,
    staleSeconds,
    stdinSlugs: slugs,
  });

  return renderHealthReport(report, {
    json: options.json,
    color: options.color,
  });
}

function stdinSlugs(options: HealthOptions): string[] | undefined {
  if (options.stdin !== true || options.stdinInput === undefined) return undefined;
  const slugs: string[] = [];
  for (const line of options.stdinInput.split(/\r?\n/)) {
    const slug = line.trim();
    if (slug.length > 0) slugs.push(slug);
  }
  return slugs;
}
