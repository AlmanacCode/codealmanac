export interface ReindexSummary {
  changed: number;
  removed: number;
  pagesIndexed: number;
  filesSeen: number;
  filesSkipped: number;
}

export interface ReindexCommandOutput {
  result: ReindexSummary;
  stdout: string;
  exitCode: number;
}

export function renderReindexResult(
  result: ReindexSummary,
): ReindexCommandOutput {
  return {
    result,
    stdout: `${formatReindexSummary(result)}\n`,
    exitCode: 0,
  };
}

// Explicit reindex gets one terse confirmation; implicit query-time reindexing
// stays silent.
function formatReindexSummary(result: ReindexSummary): string {
  const updated = `${result.changed} updated`;
  const removed = `${result.removed} removed`;
  return `reindexed: ${formatPageCount(result.pagesIndexed)} (${updated}, ${removed}${formatSkippedSuffix(result.filesSkipped)})`;
}

function formatPageCount(count: number): string {
  return `${count} page${count === 1 ? "" : "s"}`;
}

function formatSkippedSuffix(filesSkipped: number): string {
  if (filesSkipped === 0) return "";
  return `; ${filesSkipped} skipped`;
}
