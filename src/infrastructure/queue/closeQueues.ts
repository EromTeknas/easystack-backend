import { queueClient } from "./QueueClient";

export function closeQueues(): Promise<void> {
  return queueClient.close();
}
