import { authenticatedClient } from "../auth.js";
import { CloudClient, CloudHttpError } from "../client.js";
import type { ConversationTurnUpload, RepositoryResolveResult } from "../types.js";

export interface UploadCompletedTurnResult {
  uploaded: boolean;
  message: string;
  repoFullName: string | null;
  repoId: number | null;
  turnId: string | null;
}

export async function uploadCompletedTurn(args: {
  repoFullName: string | null;
  upload: ConversationTurnUpload;
}): Promise<UploadCompletedTurnResult> {
  if (args.repoFullName === null) {
    return {
      uploaded: false,
      message: "Cloud capture skipped: GitHub repository was not detected.",
      repoFullName: null,
      repoId: null,
      turnId: null,
    };
  }
  const { client } = await authenticatedClient();
  const repo = await resolveHostedRepository(client, args.repoFullName);
  if (repo === null) {
    return {
      uploaded: false,
      message: `Cloud capture skipped: ${args.repoFullName} is not a hosted Almanac repository for this account.`,
      repoFullName: args.repoFullName,
      repoId: null,
      turnId: null,
    };
  }
  const result = await client.completeConversationTurn(repo.repoId, args.upload);
  return {
    uploaded: true,
    message: `Cloud capture uploaded ${args.upload.provider} turn (${result.routingStatus}).`,
    repoFullName: repo.fullName,
    repoId: repo.repoId,
    turnId: result.turnId,
  };
}

async function resolveHostedRepository(
  client: CloudClient,
  repoFullName: string,
): Promise<RepositoryResolveResult | null> {
  try {
    return await client.resolveRepository(repoFullName);
  } catch (err: unknown) {
    if (err instanceof CloudHttpError && (err.status === 403 || err.status === 404)) {
      return null;
    }
    throw err;
  }
}
