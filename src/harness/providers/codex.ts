import type { HarnessProvider } from "../types.js";
import { HARNESS_PROVIDER_METADATA } from "./metadata.js";
import { createNotImplementedProvider } from "./not-implemented.js";

export const codexHarnessProvider: HarnessProvider = createNotImplementedProvider(
  HARNESS_PROVIDER_METADATA.codex,
);
