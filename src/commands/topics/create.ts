import { runIndexer } from "../../indexer/index.js";
import { toKebabCase } from "../../slug.js";
import { ancestorsInFile } from "../../topics/dag.js";
import {
  ensureTopic,
  findTopic,
  titleCase,
  writeTopicsFile,
  type TopicEntry,
} from "../../topics/yaml.js";
import type { TopicsCommandOutput, TopicsCreateOptions } from "./types.js";
import {
  closeWorkspace,
  openFreshTopicsWorkspace,
  resolveTopicsRepo,
  topicExists,
} from "./workspace.js";

/**
 * `almanac topics create <name> [--parent <slug>]...`.
 *
 * Policy: `--parent <slug>` MUST refer to an existing topic (created
 * earlier in topics.yaml or indexed from page frontmatter). Auto-
 * creating parents silently would let typos cascade — `create JWT
 * --parent secuirty` would quietly spawn a "secuirty" topic. Better to
 * refuse and point the user at `almanac topics create <parent>` first.
 *
 * Already-exists is not an error if no new parents are being added —
 * rerunning the same `create` is a no-op. If new parents are introduced
 * we add them (respecting cycle prevention, just like `link`).
 */
export async function runTopicsCreate(
  options: TopicsCreateOptions,
): Promise<TopicsCommandOutput> {
  const repoRoot = await resolveTopicsRepo(options);
  const slug = toKebabCase(options.name);
  if (slug.length === 0) {
    return {
      stdout: "",
      stderr: `almanac: topic name "${options.name}" has no slug-able characters\n`,
      exitCode: 1,
    };
  }
  const title = options.name.trim().length > 0 ? options.name.trim() : titleCase(slug);

  const workspace = await openFreshTopicsWorkspace(repoRoot);
  try {
    const { repoRoot, yamlPath, file, db } = workspace;
    // Resolve/validate parents BEFORE mutating the file. All-or-nothing.
    const requestedParents = (options.parents ?? [])
      .map((p) => toKebabCase(p))
      .filter((p) => p.length > 0);
    for (const p of requestedParents) {
      if (p === slug) {
        return {
          stdout: "",
          stderr: `almanac: topic cannot be its own parent\n`,
          exitCode: 1,
        };
      }
      if (!topicExists(file, db, p)) {
        return {
          stdout: "",
          stderr: `almanac: parent topic "${p}" does not exist; create it first with \`almanac topics create ${p}\`\n`,
          exitCode: 1,
        };
      }
      if (findTopic(file, p) === null) {
        // Topic exists only as an ad-hoc DB entry. Promote it into
        // topics.yaml so it has a proper record. `ensureTopic` is
        // idempotent so this is safe even if two loop iterations
        // reference the same ad-hoc parent.
        ensureTopic(file, p);
      }
    }

    const existing = findTopic(file, slug);
    if (existing === null) {
      const entry: TopicEntry = {
        slug,
        title,
        description: null,
        parents: requestedParents,
      };
      file.topics.push(entry);
    } else {
      // Add any new parents, skipping ones that already exist or would
      // create a cycle.
      for (const p of requestedParents) {
        if (existing.parents.includes(p)) continue;
        const ancestors = ancestorsInFile(file, p);
        if (ancestors.has(slug) || p === slug) {
          return {
            stdout: "",
            stderr: `almanac: adding "${p}" as a parent of "${slug}" would create a cycle\n`,
            exitCode: 1,
          };
        }
        existing.parents.push(p);
      }
      // Promote the user-supplied title only if the existing one was a
      // title-cased default (i.e., they didn't describe it yet). Don't
      // clobber a deliberate title silently.
      if (
        existing.title === titleCase(existing.slug) &&
        title !== titleCase(slug) &&
        title !== existing.title
      ) {
        existing.title = title;
      }
    }

    await writeTopicsFile(yamlPath, file);
    await runIndexer({ repoRoot });
    return {
      stdout: existing === null
        ? `created topic "${slug}"\n`
        : `updated topic "${slug}"\n`,
      stderr: "",
      exitCode: 0,
    };
  } finally {
    closeWorkspace(workspace);
  }
}
