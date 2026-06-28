export type AutomationExecFn = (
  file: string,
  args: string[],
) => Promise<{ stdout?: string; stderr?: string }>;

export interface AutomationSchedulerJobInput {
  homeDir: string;
  label: string;
  plistPath?: string;
  pathEnvironment?: string;
  programArguments: string[];
  intervalSeconds: number;
  stdoutLogName: string;
  stderrLogName: string;
  workingDirectory?: string;
}

export interface AutomationSchedulerJob {
  label: string;
  plistPath: string;
  programArguments: string[];
  intervalSeconds: number;
  environmentVariables: Record<string, string>;
  stdoutPath: string;
  stderrPath: string;
  workingDirectory?: string;
}

export interface AutomationSchedulerJobStatus {
  installed: boolean;
  plistPath: string;
  loaded: boolean;
  intervalSeconds: number | null;
  programArguments: string[] | null;
}

export interface LegacyAutomationJob {
  plistPath: string;
  intervalSeconds: number | null;
  programArguments: string[];
}

export interface AutomationScheduler {
  buildJob(input: AutomationSchedulerJobInput): AutomationSchedulerJob;
  defaultJobPath(args: {
    homeDir: string;
    label: string;
    plistPath?: string;
  }): string;
  writeJobs(jobs: AutomationSchedulerJob[]): Promise<void>;
  activateJob(job: AutomationSchedulerJob): Promise<void>;
  removeJob(plistPath: string): Promise<boolean>;
  readJobStatus(args: {
    label: string;
    plistPath: string;
  }): Promise<AutomationSchedulerJobStatus>;
  detectLegacyCaptureSweep(args: {
    homeDir: string;
    plistPath?: string;
  }): Promise<LegacyAutomationJob | null>;
  cleanupLegacyHooks(args: { homeDir: string }): Promise<void>;
}
