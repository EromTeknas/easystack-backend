import { Job, Processor, Worker } from "bullmq";
import { redisConnectionOptions } from "../../config/redis";
import logger from "../../utils/logger";

export interface QueueWorkerDescriptor<TData = unknown> {
  id: string;
  group: string;
  queueName: string;
  processor: Processor<TData>;
  concurrency?: number;
}

export function createQueueWorker<TData>(descriptor: QueueWorkerDescriptor<TData>): Worker<TData> {
  const worker = new Worker<TData>(descriptor.queueName, descriptor.processor, {
    connection: redisConnectionOptions,
    ...(descriptor.concurrency ? { concurrency: descriptor.concurrency } : {}),
  });
  const context = {
    workerId: descriptor.id,
    workerGroup: descriptor.group,
    queueName: descriptor.queueName,
  };

  worker.on("ready", () => logger.info("Queue worker ready", context));
  worker.on("active", (job: Job<TData>) => logger.info("Queue job active", {
    ...context, jobId: job.id, jobName: job.name, attempt: job.attemptsMade + 1,
  }));
  worker.on("completed", (job: Job<TData>) => logger.info("Queue job completed", {
    ...context, jobId: job.id, jobName: job.name,
  }));
  worker.on("failed", (job: Job<TData> | undefined, error: Error) => logger.error("Queue job failed", {
    ...context,
    jobId: job?.id,
    jobName: job?.name,
    attempt: job ? job.attemptsMade + 1 : undefined,
    error: error.message,
    stack: error.stack,
  }));
  worker.on("stalled", (jobId: string) => logger.warn("Queue job stalled", { ...context, jobId }));
  worker.on("error", (error: Error) => logger.error("Queue worker error", {
    ...context, error: error.message, stack: error.stack,
  }));

  logger.info("Queue worker initialized", context);
  return worker;
}
