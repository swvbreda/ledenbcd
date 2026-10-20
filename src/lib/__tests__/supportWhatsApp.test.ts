import { describe, it, expect } from "vitest";
import { classifySendResult, validateAttachment } from "../supportWhatsApp";

describe("WhatsApp reply outcome", () => {
  it("accepts only a 2xx carrying messages[0].id", () => {
    expect(classifySendResult(200, JSON.stringify({ messages: [{ id: "wamid.1" }] }))).toEqual({ outcome: "accepted", waId: "wamid.1" });
  });
  it("treats 2xx without id as unknown, never as sent", () => {
    expect(classifySendResult(200, "{}").outcome).toBe("unknown");
    expect(classifySendResult(200, "not json").outcome).toBe("unknown");
  });
  it("treats network/timeouts and 5xx as unknown (no blind retry)", () => {
    expect(classifySendResult(null, null).outcome).toBe("unknown");
    expect(classifySendResult(502, "bad gateway").outcome).toBe("unknown");
  });
  it("treats a provider 4xx rejection (e.g. outside 24h window) as failed", () => {
    const r = classifySendResult(400, JSON.stringify({ error: { code: 131047, message: "Re-engagement message" } }));
    expect(r.outcome).toBe("failed");
  });
});

describe("support attachment limits", () => {
  it("allows PDF, JPG and PNG up to 10 MB", () => {
    expect(validateAttachment({ type: "application/pdf", size: 10 * 1024 * 1024, name: "a.pdf" })).toBeNull();
    expect(validateAttachment({ type: "image/png", size: 1, name: "a.png" })).toBeNull();
  });
  it("rejects files over 10 MB, empty files, html, svg and executables", () => {
    expect(validateAttachment({ type: "application/pdf", size: 10 * 1024 * 1024 + 1, name: "a.pdf" })).not.toBeNull();
    expect(validateAttachment({ type: "image/jpeg", size: 0, name: "a.jpg" })).not.toBeNull();
    for (const type of ["text/html", "image/svg+xml", "application/x-msdownload"]) {
      expect(validateAttachment({ type, size: 10, name: "x" })).not.toBeNull();
    }
  });
});
