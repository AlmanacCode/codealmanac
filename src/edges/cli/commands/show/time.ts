export function formatTimestamp(epochSeconds: number): string {
  return new Date(epochSeconds * 1000).toISOString();
}
