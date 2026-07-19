import type { Worker } from "bullmq";
import { createQueueWorker } from "../../../../infrastructure/queue";
import { EMAIL_QUEUE_NAME, EmailJobData } from "./email.jobs";
import { EmailJobProcessor } from "./email.processor";

export function createEmailWorkers(): Worker[] {
  const processor = new EmailJobProcessor();
  return [createQueueWorker<EmailJobData>({
    id: "transactional-email",
    group: "email",
    queueName: EMAIL_QUEUE_NAME,
    processor: processor.process.bind(processor),
  })];
}
