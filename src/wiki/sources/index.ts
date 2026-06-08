export {
  collectSourceHealthFindings,
  type SourceHealthFindings,
} from "./health.js";
export {
  applySourceFrontmatterFix,
  migrateLegacySourceFrontmatter,
  migrateLegacySources,
  writeSourceFrontmatterFix,
  type MigrateLegacySourcesOptions,
  type MigrateLegacySourcesResult,
  type SourceFrontmatterFixResult,
} from "./maintenance.js";
