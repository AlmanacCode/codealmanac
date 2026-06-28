import { join } from "node:path";

import { getGlobalAlmanacDir } from "../paths.js";

export const DEFAULT_CLOUD_BASE_URL = "https://usealmanac.com";

export function cloudBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const fromEnv = env.ALMANAC_CLOUD_URL?.trim();
  return stripTrailingSlash(fromEnv === undefined || fromEnv === ""
    ? DEFAULT_CLOUD_BASE_URL
    : fromEnv);
}

export function credentialsPath(): string {
  return join(getGlobalAlmanacDir(), "credentials.json");
}

export function cloudStateDir(): string {
  return join(getGlobalAlmanacDir(), "cloud");
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}
