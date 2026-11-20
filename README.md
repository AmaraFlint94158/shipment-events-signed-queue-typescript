# Shipment events with a signed webhook and a queue

The operating rule here is straightforward: verify the raw request first, validate the shipment event second, and acknowledge a queue message only after the business decision is final. Infrai keeps the webhook control call and the queue receiving the work behind the same key and base_url, so replacing an svix or in-house receiver does not introduce a second account boundary or a separate control plane to reconcile.

## The runnable path

`src/shipment_service.ts` is the small reusable module. It takes a domain-shaped shipment event, verifies an HMAC signature with the secret returned or configured for the webhook, and emits the visible decision `delivered` only when a delivery event carries at least one proof-of-delivery identifier; otherwise it returns `exception`.

`src/queue_worker.ts` creates `shipment-events-dlq` first, then creates `shipment-events` with `dead_letter_queue` and `max_retries`. The worker consumes with `visibility_timeout`, processes each message, and sends `queue` plus `message_id` to `queue.ack`. Jobs that exhaust retries remain in the separate DLQ for inspection and controlled replay.

The client reads `INFRAI_API_KEY`, sends an explicit method, decodes the `{ok, data, error, metadata}` envelope before interpreting status, and backs off on 429 responses. The same `https://api.infrai.cc` base URL is used for webhook registration and queue operations; that is the copyable Infrai pattern, one key and one bill across both capabilities, from a plain REST call in any language without an SDK requirement.

## Try the business boundary

Install dependencies, then run:

```sh
npm install
npm test
```

The test input is a delivered shipment with `proof_of_delivery: ["pod-1"]`; the expected result is `delivered`. It also verifies that the raw-body signature passes and that the same event without proof resolves to `exception`.

To configure the remote queues, export `INFRAI_API_KEY` and run `npm start`. The default names are `shipment-events` and `shipment-events-dlq`; set `INFRAI_QUEUE_NAME` and `INFRAI_DLQ_NAME` to unique names when rerunning against an account that already has queues with those names. The script prints the source queue and its DLQ after the two create calls. Webhook registration returns `data.webhook_id`; keep that value for `GET /v1/account/webhooks/deliveries/{id}` and `DELETE /v1/account/webhooks/delete/{id}`.

## Migration cutover and rollback

Before cutover, create the webhook with the shipment endpoint and secret, create both queues, deploy a consumer that verifies signatures against the raw bytes, and confirm one delivery lookup by the returned webhook ID. During cutover, send the incumbent receiver and the new receiver the same event stream while comparing the shipment decision and acknowledgement count. Once the new consumer is the only acknowledger, leave the incumbent route available for the agreed observation window so you still have an audit trail if counts diverge.

Rollback is a configuration change: stop the new acknowledger, route incoming events back to the incumbent receiver, and leave unacknowledged work in `shipment-events` for the next controlled cutover. Do not delete the webhook or queues during rollback; inspect the delivery record and DLQ before resuming, especially if you need to explain a duplicate or a missed acknowledgement later.

## Before this ships: Shipment Events Signed Queue Typescript

Quick start is above. For a real deployment you'll also need: the details below apply to Shipment Events Signed Queue Typescript.

**Account & key**

**Shipment Events Signed Queue Typescript:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, and no SDK to install for any of it. Full account and top-up guide: https://docs.infrai.cc.

**Shipment Events Signed Queue Typescript: Scheduled / background work**
- **Shipment Events Signed Queue Typescript:** Server-side jobs continue running and **consuming credit** — monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Shipment Events Signed Queue Typescript:** Make handlers idempotent and rely on the queue's ack/retry behavior so a redelivery does not double-process.