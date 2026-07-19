import type { JobsOptions } from "bullmq";

export interface QueueDescriptor<TData> {
  queueName: string;
  jobName: string;
  defaultJobOptions: JobsOptions;
  describe(data: TData): Record<string, unknown>;
}
