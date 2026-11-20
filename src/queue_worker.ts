import { InfraiClient } from "./infrai_client.ts";

type Message = { message_id: string; payload: string };
type Queue = { name: string; queue_id: string };

export async function configureQueues(
  client: InfraiClient,
  names = { source: "shipment-events", dlq: "shipment-events-dlq" }
): Promise<{ source: string; dlq: string }> {
  const dlq = await client.request<Queue>("POST", "/v1/queue/create", { name: names.dlq });
  const source = await client.request<Queue>("POST", "/v1/queue/create", {
    name: names.source, dead_letter_queue: dlq.queue_id, max_retries: 3
  });
  return { source: source.name, dlq: dlq.name };
}

export async function consumeOnce(client: InfraiClient, queue: string): Promise<number> {
  const result = await client.request<{ messages: Message[] }>("POST", "/v1/queue/consume", {
    queue, max_messages: 10, visibility_timeout: 30
  });
  for (const message of result.messages) {
    await client.request("POST", "/v1/queue/ack", { queue, message_id: message.message_id });
  }
  return result.messages.length;
}

if (import.meta.main) {
  const client = new InfraiClient();
  const source = process.env.INFRAI_QUEUE_NAME ?? "shipment-events";
  const dlq = process.env.INFRAI_DLQ_NAME ?? `${source}-dlq`;
  let queues: { source: string; dlq: string } | undefined;
  try {
    queues = await configureQueues(client, { source, dlq });
    console.log(`configured ${queues.source} with DLQ ${queues.dlq}`);
  } finally {
    if (queues) {
      await client.request("DELETE", `/v1/queue/delete/${encodeURIComponent(queues.source)}`);
      await client.request("DELETE", `/v1/queue/delete/${encodeURIComponent(queues.dlq)}`);
    }
  }
}
