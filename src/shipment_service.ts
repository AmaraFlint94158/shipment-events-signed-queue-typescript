import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { InfraiClient } from "./infrai_client.ts";

export const shipmentEvent = z.object({
  event_id: z.string().min(1), shipment_id: z.string().min(1),
  event_type: z.enum(["shipment.delivered", "shipment.exception"]),
  occurred_at: z.string().min(1), proof_of_delivery: z.array(z.string()).default([]),
  exception_code: z.string().optional()
});
export type ShipmentEvent = z.infer<typeof shipmentEvent>;

export function verifySignature(rawBody: string, signature: string, secret: string): boolean {
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const actual = Buffer.from(signature, "utf8");
  const wanted = Buffer.from(expected, "utf8");
  return actual.length === wanted.length && timingSafeEqual(actual, wanted);
}

export function decideShipment(event: ShipmentEvent): "delivered" | "exception" {
  return event.event_type === "shipment.delivered" && event.proof_of_delivery.length > 0 ? "delivered" : "exception";
}

export async function registerShipmentWebhook(client: InfraiClient, url: string, secret: string): Promise<string> {
  const data = await client.request<{ webhook_id?: string }>("POST", "/v1/account/webhooks/register", {
    url, events: ["account.updated"], secret, description: "shipment event receiver"
  });
  if (!data.webhook_id) throw new Error("webhook registration returned no webhook_id");
  return data.webhook_id;
}
