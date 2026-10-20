import { describe, it, expect, vi } from "vitest";
import { receiveWhatsAppConnector, type ConnectorReceipt } from "../whatsappConnector";

const secret = "isolated-test-connection-key";
const payload = { entry: [{ changes: [{ value: { messages: [{
  id: "wamid.test", from: "31600000000", type: "text", text: { body: "Test" },
}] } }] }] };
async function request(body = JSON.stringify(payload), options: {
  key?: string; delivery?: string; event?: string; timestamp?: string; tamper?: boolean;
} = {}) {
  const timestamp = options.timestamp ?? String(Date.now());
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(options.key ?? secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${body}`));
  const signature = "sha256=" + Array.from(new Uint8Array(mac)).map(b => b.toString(16).padStart(2, "0")).join("");
  return new Request("https://example.test/api/public/whatsapp/webhook", {
    method: "POST", body: options.tamper ? body + " " : body,
    headers: { "x-lovable-signature": signature, "x-lovable-timestamp": timestamp,
      "x-lovable-delivery": options.delivery ?? "delivery-test", "x-lovable-event": options.event ?? "whatsapp.message" },
  });
}
describe("connector receipt without external calls", () => {
  it("verifies the real library signature before handing off validated messages", async () => {
    const store = vi.fn(async (_receipt: ConnectorReceipt) => {});
    expect((await receiveWhatsAppConnector(await request(), secret, store)).status).toBe(200);
    expect(store.mock.calls[0]?.[0].messages[0]).toMatchObject({ waMessageId: "wamid.test", body: "Test" });
  });
  it.each([{ key: "wrong" }, { tamper: true }, { timestamp: "1" }])("rejects forged/modified/stale requests %j", async options => {
    const store = vi.fn();
    expect((await receiveWhatsAppConnector(await request(undefined, options), secret, store)).status).toBe(401);
    expect(store).not.toHaveBeenCalled();
  });
  it("fails closed with missing credentials", async () => {
    const store = vi.fn();
    expect((await receiveWhatsAppConnector(await request(), undefined, store)).status).toBe(503);
    expect(store).not.toHaveBeenCalled();
  });
  it.each(["{", "{}", '{"entry":[null]}'])("rejects malformed JSON/envelopes %s", async body => {
    const store = vi.fn();
    expect((await receiveWhatsAppConnector(await request(body), secret, store)).status).toBe(400);
    expect(store).not.toHaveBeenCalled();
  });
  it("requires delivery metadata", async () => {
    const store = vi.fn();
    expect((await receiveWhatsAppConnector(await request(undefined, { delivery: "" }), secret, store)).status).toBe(400);
    expect(store).not.toHaveBeenCalled();
  });
  it("returns retryable failure rather than acknowledging failed durable storage", async () => {
    expect((await receiveWhatsAppConnector(await request(), secret, async () => { throw Error("offline"); })).status).toBe(503);
  });
  it("preserves delivery and message keys across retries for an idempotent store", async () => {
    const deliveries = new Set<string>();
    const messages = new Set<string>();
    let unread = 0;
    const store = async (receipt: ConnectorReceipt) => {
      if (deliveries.has(receipt.deliveryId)) return;
      deliveries.add(receipt.deliveryId);
      for (const message of receipt.messages) {
        if (!messages.has(message.waMessageId)) { messages.add(message.waMessageId); unread++; }
      }
    };
    for (const delivery of ["delivery-1", "delivery-1", "delivery-2"]) {
      expect((await receiveWhatsAppConnector(await request(undefined, { delivery }), secret, store)).status).toBe(200);
    }
    expect(deliveries.size).toBe(2);
    expect(messages.size).toBe(1);
    expect(unread).toBe(1);
  });
  it("retains unknown history events without producing imports", async () => {
    const store = vi.fn(async (_receipt: ConnectorReceipt) => {});
    const body = JSON.stringify({ entry: [{ changes: [{ value: { history: [] } }] }] });
    expect((await receiveWhatsAppConnector(await request(body, { event: "whatsapp.history" }), secret, store)).status).toBe(200);
    expect(store.mock.calls[0]?.[0].messages).toEqual([]);
    expect(store.mock.calls[0]?.[0].payload).toEqual(JSON.parse(body));
  });
});