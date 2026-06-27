export type IndexerWarningSink = (message: string) => void;

export const ignoreIndexerWarnings: IndexerWarningSink = () => {};

export function indexerWarningSink(
  sink: IndexerWarningSink | undefined,
): IndexerWarningSink {
  return sink ?? ignoreIndexerWarnings;
}
