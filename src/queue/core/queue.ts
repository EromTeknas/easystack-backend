import { JobsOptions, Queue } from "bullmq";
import { redisConnectionOptions } from "../../config/redis";
import logger from "../../utils/logger";

export interface QueueDescriptor<TData> {
  queueName: string;
  jobName: string;
  defaultJobOptions: JobsOptions;
  describe(data: TData): Record<string, unknown>;
}

type ApplicationQueue<TData> = Queue<TData, unknown, string, TData, unknown, string>;
const queues = new Map<string, ApplicationQueue<unknown>>();

export function getQueue<TData>(queueName: string): ApplicationQueue<TData> {
  const existing = queues.get(queueName);
  if (existing) return existing as ApplicationQueue<TData>;

  const queue = new Queue<TData, unknown, string, TData, unknown, string>(
    queueName,
    { connection: redisConnectionOptions },
  );
  queues.set(queueName, queue as ApplicationQueue<unknown>);
  return queue;
}

export async function enqueue<TData>(
  descriptor: QueueDescriptor<TData>,
  data: TData,
  options: JobsOptions = {},
): Promise<void> {
  const queue = getQueue<TData>(descriptor.queueName);
  const jobOptions = { ...descriptor.defaultJobOptions, ...options };
  const context = descriptor.describe(data);

  logger.info("Queue job enqueue started", {
    queueName: descriptor.queueName,
    jobName: descriptor.jobName,
    ...context,
  });

  const job = await queue.add(descriptor.jobName, data, jobOptions);

  logger.info("Queue job enqueued", {
    queueName: descriptor.queueName,
    jobName: descriptor.jobName,
    jobId: job.id,
    ...context,
  });
}

export async function closeProducerQueues(): Promise<void> {
  await Promise.all([...queues.values()].map((queue) => queue.close()));
  queues.clear();
}
