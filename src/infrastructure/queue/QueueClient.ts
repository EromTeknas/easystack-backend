import { JobsOptions, Queue } from "bullmq";
import { redisConnectionOptions } from "../../config/redis";
import logger from "../../utils/logger";
import type { QueueDescriptor } from "./QueueDescriptor";

type ApplicationQueue<TData> = Queue<TData, unknown, string, TData, unknown, string>;

export class QueueClient {
  private readonly queues = new Map<string, ApplicationQueue<unknown>>();

  getQueue<TData>(queueName: string): ApplicationQueue<TData> {
    const existing = this.queues.get(queueName);
    if (existing) return existing as ApplicationQueue<TData>;

    const queue = new Queue<TData, unknown, string, TData, unknown, string>(
      queueName,
      { connection: redisConnectionOptions },
    );
    this.queues.set(queueName, queue as ApplicationQueue<unknown>);
    return queue;
  }

  async enqueue<TData>(
    descriptor: QueueDescriptor<TData>,
    data: TData,
    options: JobsOptions = {},
  ): Promise<void> {
    const queue = this.getQueue<TData>(descriptor.queueName);
    const context = descriptor.describe(data);

    logger.info("Queue job enqueue started", {
      queueName: descriptor.queueName,
      jobName: descriptor.jobName,
      ...context,
    });

    const job = await queue.add(descriptor.jobName, data, {
      ...descriptor.defaultJobOptions,
      ...options,
    });

    logger.info("Queue job enqueued", {
      queueName: descriptor.queueName,
      jobName: descriptor.jobName,
      jobId: job.id,
      ...context,
    });
  }

  async close(): Promise<void> {
    await Promise.all([...this.queues.values()].map((queue) => queue.close()));
    this.queues.clear();
  }
}

export const queueClient = new QueueClient();
