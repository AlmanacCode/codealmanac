import type {
  AgentRunSpec,
  HarnessProvider,
  ProviderMetadata,
  ProviderStatus,
} from "../types.js";

export function createNotImplementedProvider(
  metadata: ProviderMetadata,
): HarnessProvider {
  return {
    metadata,
    checkStatus: async (): Promise<ProviderStatus> => ({
      id: metadata.id,
      installed: false,
      authenticated: false,
      detail: `${metadata.displayName} harness adapter is not implemented yet`,
    }),
    run: async (spec: AgentRunSpec) => ({
      success: false,
      result: "",
      error:
        `${metadata.displayName} harness adapter is not implemented yet ` +
        `for ${spec.metadata?.operation ?? "unknown"} runs`,
    }),
  };
}
