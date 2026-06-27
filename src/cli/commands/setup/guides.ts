import {
  SETUP_IMPORT_LINE,
  hasSetupImportLine,
} from "../../../services/setup/index.js";

/** The exact import line we manage. Changing this requires updating uninstall too. */
export const IMPORT_LINE = SETUP_IMPORT_LINE;

export function hasImportLine(contents: string): boolean {
  return hasSetupImportLine(contents);
}
