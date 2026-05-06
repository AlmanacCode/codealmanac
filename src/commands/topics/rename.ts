import { runIndexer } from "../../indexer/index.js";
import { toKebabCase } from "../../slug.js";
import {
  findTopic,
  titleCase,
  writeTopicsFile,
} from "../../topics/yaml.js";
import { rewriteTopicOnPages } from "./page-rewrite.js";
import type { TopicsCommandOutput, TopicsRenameOptions } from "./types.js";
import {
  closeWorkspace,
  openFreshTopicsWorkspace,
  resolveTopicsRepo,
  topicExists,
} from "./workspace.js";

/**
 * `almanac topics rename <old> <new>`. Rewrites the slug both in
 * `topics.yaml` (as an entry key and in anyone who declared it as a
 * parent) and in every affected page's frontmatter.
 *
 * Refuses if `<new>` is already a distinct topic — "merging" two topics
 * should be explicit, not a silent side effect of a rename.
 */
export async function runTopicsRename(
  options: TopicsRenameOptions,
): Promise<TopicsCommandOutput> {
  const repoRoot = await resolveTopicsRepo(options);
  const oldSlug = toKebabCase(options.oldSlug);
  const newSlug = toKebabCase(options.newSlug);
  if (oldSlug.length === 0 || newSlug.length === 0) {
    return { stdout: "", stderr: `almanac: empty topic slug\n`, exitCode: 1 };
  }
  if (oldSlug === newSlug) {
    return {
      stdout: `topic "${oldSlug}" unchanged\n`,
      stderr: "",
      exitCode: 0,
    };
  }

  const workspace = await openFreshTopicsWorkspace(repoRoot);
  let pagesUpdated: number;
  try {
    const { repoRoot, yamlPath, file, db } = workspace;
    // Fetch existence info. `oldInYaml` is kept as a direct reference
    // because we mutate the entry; the DB check is only needed when
    // the slug isn't in the file (ad-hoc-only).
    const oldInYaml = findTopic(file, oldSlug);
    if (!topicExists(file, db, oldSlug)) {
      return {
        stdout: "",
        stderr: `almanac: no such topic "${oldSlug}"\n`,
        exitCode: 1,
      };
    }

    if (topicExists(file, db, newSlug)) {
      return {
        stdout: "",
        stderr: `almanac: topic "${newSlug}" already exists; delete it first if you intend to merge\n`,
        exitCode: 1,
      };
    }

    // Rewrite `topics.yaml`: the entry itself (if present) plus any
    // parent reference to `oldSlug`.
    if (oldInYaml !== null) {
      oldInYaml.slug = newSlug;
      if (oldInYaml.title === titleCase(oldSlug)) {
        // Title was the auto-generated default — refresh it to the new
        // slug's title-case. A custom title stays as-is.
        oldInYaml.title = titleCase(newSlug);
      }
    }
    for (const t of file.topics) {
      t.parents = t.parents.map((p) => (p === oldSlug ? newSlug : p));
    }

    // Write ordering matters: topics.yaml FIRST (atomic tmp+rename), THEN
    // the page rewrites. If topics.yaml write fails, no page was touched.
    // If a page rewrite fails midway, topics.yaml already reflects the
    // rename so the next reindex picks up the ad-hoc state and the user
    // can re-run to finish the remaining pages. The opposite ordering
    // would leave half-rewritten pages referencing a slug that
    // topics.yaml doesn't know about.
    await writeTopicsFile(yamlPath, file);

    // Rewrite every page that has `oldSlug` in `topics:` frontmatter.
    pagesUpdated = await rewriteTopicOnPages(repoRoot, (topics) =>
      topics.map((t) => (t === oldSlug ? newSlug : t)),
    );
  } finally {
    closeWorkspace(workspace);
  }

  await runIndexer({ repoRoot: workspace.repoRoot });
  return {
    stdout: `renamed ${oldSlug} → ${newSlug} (${pagesUpdated} page${pagesUpdated === 1 ? "" : "s"} updated)\n`,
    stderr: "",
    exitCode: 0,
  };
}
