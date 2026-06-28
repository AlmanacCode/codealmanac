import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { getRepoAlmanacDir } from "./repo-location.js";

export interface WikiFileScaffoldOptions {
  repoRoot: string;
  readmeContents: string;
}

export interface WikiFileScaffoldResult {
  almanacDir: string;
  created: boolean;
}

export async function scaffoldWikiFiles(
  options: WikiFileScaffoldOptions,
): Promise<WikiFileScaffoldResult> {
  const almanacDir = getRepoAlmanacDir(options.repoRoot);
  const pagesDir = join(almanacDir, "pages");
  const readmePath = join(almanacDir, "README.md");
  const alreadyExisted = existsSync(almanacDir);

  await mkdir(pagesDir, { recursive: true });

  if (!existsSync(readmePath)) {
    await writeFile(readmePath, options.readmeContents, "utf8");
  }

  await ensureGitignoreHasRuntimeArtifacts(options.repoRoot);

  return { almanacDir, created: !alreadyExisted };
}

async function ensureGitignoreHasRuntimeArtifacts(
  repoRoot: string,
): Promise<void> {
  const path = join(repoRoot, ".gitignore");
  const targets = [
    ".almanac/index.db",
    ".almanac/index.db-wal",
    ".almanac/index.db-shm",
    ".almanac/jobs/",
  ];

  let existing = "";
  if (existsSync(path)) {
    existing = await readFile(path, "utf8");
  }

  const lines = existing.split(/\r?\n/).map((line) => line.trim());
  const missing = targets.filter((target) => !lines.includes(target));
  if (missing.length === 0) return;

  const hasHeader = lines.includes("# codealmanac");
  const block = hasHeader
    ? missing.join("\n") + "\n"
    : `# codealmanac\n${missing.join("\n")}\n`;
  const separator =
    existing.length === 0 ? "" : existing.endsWith("\n") ? "\n" : "\n\n";

  await writeFile(path, `${existing}${separator}${block}`, "utf8");
}
