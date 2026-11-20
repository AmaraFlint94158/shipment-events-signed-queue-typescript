import assert from "node:assert/strict";
import { decideShipment, shipmentEvent, verifySignature } from "./shipment_service.ts";
import { createHmac } from "node:crypto";

const input = { event_id: "evt-1", shipment_id: "shp-1", event_type: "shipment.delivered", occurred_at: "2026-10-25T08:00:00Z", proof_of_delivery: ["pod-1"] };
const parsed = shipmentEvent.parse(input);
assert.equal(decideShipment(parsed), "delivered");
const raw = JSON.stringify(input);
const signature = createHmac("sha256", "local-secret").update(raw).digest("hex");
assert.equal(verifySignature(raw, signature, "local-secret"), true);
assert.equal(decideShipment(shipmentEvent.parse({ ...input, proof_of_delivery: [] })), "exception");
console.log("shipment decision and signature boundary passed");
