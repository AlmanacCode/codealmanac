import { createPlatformSetupInstructionRuntime } from "../platform/setup/instructions.js";
import type { SetupInstructionRuntime } from "../shared/setup-instructions.js";

export function createSetupInstructionRuntime(): SetupInstructionRuntime {
  return createPlatformSetupInstructionRuntime();
}
