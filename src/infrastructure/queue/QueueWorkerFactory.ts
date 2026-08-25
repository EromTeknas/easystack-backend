import { Job, Processor, Worker } from "bullmq";
import { redisConnectionOptions } from "../../config/redis";
import { createQueueLogger } from "../../utils/queue-logger";

export interface QueueWorkerDescriptor<TData = unknown> {
  id: string;
  group: string;
  queueName: string;
  processor: Processor<TData>;
  concurrency?: number;
}

export function createQueueWorker<TData>(descriptor: QueueWorkerDescriptor<TData>): Worker<TData> {
  const workerLogger = createQueueLogger(descriptor.queueName);
  
  const worker = new Worker<TData>(descriptor.queueName, descriptor.processor, {
    connection: redisConnectionOptions,
    ...(descriptor.concurrency ? { concurrency: descriptor.concurrency } : {}),
  });
  const context = {
    workerId: descriptor.id,
    workerGroup: descriptor.group,
  };

  worker.on("ready", () => workerLogger.info("Queue worker ready", context));
  worker.on("active", (job: Job<TData>) => workerLogger.info("Queue job active", {
    ...context, jobId: job.id, jobName: job.name, attempt: job.attemptsMade + 1,
  }));
  worker.on("completed", (job: Job<TData>) => workerLogger.info("Queue job completed", {
    ...context, jobId: job.id, jobName: job.name,
  }));
  worker.on("failed", (job: Job<TData> | undefined, error: Error) => workerLogger.error("Queue job failed", {
    ...context,
    jobId: job?.id,
    jobName: job?.name,
    attempt: job ? job.attemptsMade + 1 : undefined,
    error: error.message,
    stack: error.stack,
  }));
  worker.on("stalled", (jobId: string) => workerLogger.warn("Queue job stalled", { ...context, jobId }));
  worker.on("error", (error: Error) => workerLogger.error("Queue worker error", {
    ...context, error: error.message, stack: error.stack,
  }));

  workerLogger.info("Queue worker initialized", context);
  return worker;
}
