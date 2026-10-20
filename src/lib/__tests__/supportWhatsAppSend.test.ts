import { describe, it, expect, vi } from "vitest";
import { runSupportWhatsAppReply, type SupportRpc } from "../supportWhatsApp";

const data = { threadId: "00000000-0000-0000-0000-000000000001", body: "hoi", clientKey: "00000000-0000-0000-0000-000000000002" };
const env = { lovableKey: "k", waKey: "w" };

function mockRpc(reserve: { data?: unknown; error?: { message: string } | null }) {
  const calls: { n: string; a?: Record<string, unknown> }[] = [];
  const rpc: SupportRpc = async (n, a) => {
    calls.push({ n, a });
    if (n === "support_wa_reserve_reply") return { data: reserve.data ?? null, error: reserve.error ?? null };
    return { data: null, error: null };
  };
  return { rpc, calls };
}
const fresh = { data: { message_id: "m1", existing: false, state: "pending", phone: "31600000001", body: "hoi" } };

describe("WhatsApp reply send flow (mocked gateway)", () => {
  it("does not POST when the reservation already exists (double click / unknown result)", async () => {
    for (const state of ["pending", "unknown", "failed", "queued"]) {
      const { rpc, calls } = mockRpc({ data: { message_id: "m1", existing: true, state } });
      const f = vi.fn();
      const out = await runSupportWhatsAppReply(data, rpc, env, f as unknown as typeof fetch);
      expect(f).not.toHaveBeenCalled();
      expect(out).toEqual({ state, existing: true });
      expect(calls.map((c) => c.n)).toEqual(["support_wa_reserve_reply"]);
    }
  });

  it("does not POST outside the 24h window or without a link", async () => {
    for (const [msg, state] of [["outside_window", "outside_window"], ["no_whatsapp_link", "no_link"]]) {
      const f = vi.fn();
      const out = await runSupportWhatsAppReply(data, mockRpc({ error: { message: msg } }).rpc, env, f as unknown as typeof fetch);
      expect(f).not.toHaveBeenCalled();
      expect(out.state).toBe(state);
    }
  });

  it("records a network timeout as unknown after exactly one POST and never retries", async () => {
    const { rpc, calls } = mockRpc(fresh);
    const f = vi.fn().mockRejectedValue(new Error("timeout"));
    const out = await runSupportWhatsAppReply(data, rpc, env, f as unknown as typeof fetch);
    expect(f).toHaveBeenCalledTimes(1);
    expect(out.state).toBe("unknown");
    expect(calls[1]).toMatchObject({ n: "support_wa_finish_reply", a: { p_outcome: "unknown", p_wa_id: null } });
  });

  it("marks only a 2xx with a message id as accepted", async () => {
    const { rpc, calls } = mockRpc(fresh);
    const f = vi.fn().mockResolvedValue(new Response(JSON.stringify({ messages: [{ id: "wamid.1" }] }), { status: 200 }));
    expect((await runSupportWhatsAppReply(data, rpc, env, f as unknown as typeof fetch)).state).toBe("queued");
    expect(calls[1].a).toMatchObject({ p_outcome: "accepted", p_wa_id: "wamid.1" });
  });

  it("without gateway keys marks failed and sends nothing (no app-only fallback as sent)", async () => {
    const { rpc, calls } = mockRpc(fresh);
    const f = vi.fn();
    const out = await runSupportWhatsAppReply(data, rpc, {}, f as unknown as typeof fetch);
    expect(f).not.toHaveBeenCalled();
    expect(out.state).toBe("failed");
    expect(calls[1].a).toMatchObject({ p_outcome: "failed" });
  });
});
