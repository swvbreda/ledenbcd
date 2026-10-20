import { describe, expect, it } from "vitest";
import { normalizePublisherPhone } from "../whatsappPublishers";
import { incomingMessageEnvelopes } from "../whatsappWebhook";

describe("explicit publisher numbers", () => {
  it("normalizes explicit international E164 without guessing a country", () => {
    expect(normalizePublisherPhone(" +31 (6) 1234-5678 ")).toBe("+31612345678");
    expect(normalizePublisherPhone("0031612345678")).toBe("+31612345678");
    expect(normalizePublisherPhone("0612345678")).toBeNull();
    expect(normalizePublisherPhone("31612345678")).toBeNull();
  });
  it("rejects empty, malformed and oversized numbers", () => {
    for (const value of ["", "+0123456789", "+31abc123456", "+" + "1".repeat(16)]) expect(normalizePublisherPhone(value)).toBeNull();
  });
});
describe("verified legacy ingress", () => {
  it("keeps forwarded flags and full original text for the transaction", () => {
    const message = { id: "test-message", from: "31612345678", type: "text", context: { forwarded: true }, text: { body: "Titel\n\nhttps://example.test\n" } };
    expect(incomingMessageEnvelopes({ entry: [{ changes: [{ value: { metadata: { phone_number_id: "recipient" }, messages: [message] } }] }] })).toEqual([{ message, recipient: "recipient" }]);
  });
  it("never turns echoes, statuses, history or contacts into incoming messages", () => {
    for (const field of ["message_echoes", "statuses", "history", "contacts"]) expect(incomingMessageEnvelopes({ entry: [{ changes: [{ value: { [field]: [{ id: "x", from: "31612345678" }] } }] }] })).toEqual([]);
  });
});