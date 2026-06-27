import type { HarnessEvent } from "../harness/events.js";
import { appendJobEvent } from "./logs.js";
import { readJobRecord, writeJobRecord } from "../stores/jobs/records.js";
import type { JobRecord } from "./types.js";

export interface JobEventLogger {
  onEvent(event: HarnessEvent): Promise<void>;
  appendError(error: string): Promise<void>;
  waitForWrites(): Promise<void>;
}

export function createJobEventLogger(args: {
  logPath: string;
  jobId: string;
  now: () => Date;
  recordPath: string;
  fallbackRecord: JobRecord;
  observer?: (event: HarnessEvent) => void | Promise<void>;
}): JobEventLogger {
  let sequence = 0;
  const pendingWrites: Promise<void>[] = [];

  return {
    onEvent: (event) => {
      sequence += 1;
      const writes = [
        appendJobEvent(args.logPath, event, args.now(), {
          jobId: args.jobId,
          sequence,
        }),
        persistProviderSessionId({
          recordPath: args.recordPath,
          fallbackRecord: args.fallbackRecord,
          event,
        }),
      ];
      if (args.observer !== undefined) {
        writes.push(Promise.resolve(args.observer(event)));
      }
      const write = Promise.allSettled(writes).then(() => undefined);
      pendingWrites.push(write);
      return write;
    },
    appendError: (error) => {
      sequence += 1;
      return appendJobEvent(args.logPath, {
        type: "error",
        error,
      }, args.now(), {
        jobId: args.jobId,
        sequence,
      });
    },
    waitForWrites: () => Promise.allSettled(pendingWrites).then(() => undefined),
  };
}

async function persistProviderSessionId(args: {
  recordPath: string;
  fallbackRecord: JobRecord;
  event: HarnessEvent;
}): Promise<void> {
  const providerSessionId = providerSessionIdFromEvent(args.event);
  if (providerSessionId === undefined) return;
  const current = await readJobRecord(args.recordPath);
  const record = current ?? args.fallbackRecord;
  if (record.providerSessionId !== undefined) return;
  await writeJobRecord(args.recordPath, {
    ...record,
    providerSessionId,
  });
}

function providerSessionIdFromEvent(event: HarnessEvent): string | undefined {
  if (event.type === "provider_session") {
    return event.providerSessionId;
  }
  if (event.type === "done" && event.providerSessionId !== undefined) {
    return event.providerSessionId;
  }
  return undefined;
}
