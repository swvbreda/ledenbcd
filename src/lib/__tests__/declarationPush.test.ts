import { describe, expect, it, vi } from "vitest";
import { DECL_PUSH_BODY, DECL_PUSH_TITLE, declarationRoute, processDeclarationNotification, type DeclarationPushPort } from "@/lib/declarationPush";

const SIMONE = "a7fce7fa-600b-48ef-8faf-7aea6918660a";
const BERNARD = "15adafb2-cb6a-4212-8604-68d27814ba59";
const OTHER_ADMIN = "22222222-2222-2222-2222-222222222222";
const DECL = "33333333-3333-3333-3333-333333333333";

function port(over: Partial<DeclarationPushPort> = {}, recipient = BERNARD) {
  let claimed = false;
  const finish = vi.fn(async () => {});
  const p: DeclarationPushPort = {
    claim: async (id) => (claimed ? null : ((claimed = true), { id, recipient_id: recipient, declaration_id: DECL, push_attempts: 1 })),
    recipients: async () => [SIMONE, BERNARD],
    currentDeclaration: async () => ({ status: "pending", year: 2026 }),
    deviceTokens: async () => ["aa"],
    finish,
    removeInvalidTokens: vi.fn(async () => {}),
    ...over,
  };
  return { p, finish };
}

describe("declaratiepush", () => {
  it("lockscreen zonder bedragen/namen en route naar de juiste declaratie", async () => {
    const { p } = port();
    const send = vi.fn(async () => ({ ok: true, status: 200 }));
    expect((await processDeclarationNotification(p, send, "n1")).outcome).toBe("sent");
    expect(send).toHaveBeenCalledWith("aa", { title: DECL_PUSH_TITLE, body: DECL_PUSH_BODY, route: `/financien?tab=intern&year=2026&declaratie=${DECL}` });
    expect(`${DECL_PUSH_TITLE} ${DECL_PUSH_BODY}`).not.toMatch(/€|\d/);
  });

  it("tweede verwerking (retry/gelijktijdig) stuurt niet opnieuw", async () => {
    const { p } = port();
    const send = vi.fn(async () => ({ ok: true, status: 200 }));
    await processDeclarationNotification(p, send, "n1");
    expect((await processDeclarationNotification(p, send, "n1")).outcome).toBe("not_claimed");
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("andere beheerder dan Simone/Bernard krijgt nooit push", async () => {
    const { p, finish } = port({}, OTHER_ADMIN);
    const send = vi.fn();
    expect((await processDeclarationNotification(p, send, "n1")).outcome).toBe("skipped");
    expect(send).not.toHaveBeenCalled();
    expect(finish).toHaveBeenCalledWith("n1", expect.objectContaining({ status: "skipped" }));
  });

  it("goedkeurder die rechten verloor krijgt geen push", async () => {
    const { p } = port({ recipients: async () => [SIMONE] });
    const send = vi.fn();
    expect((await processDeclarationNotification(p, send, "n1")).outcome).toBe("skipped");
    expect(send).not.toHaveBeenCalled();
  });

  it("al goedgekeurde/afgewezen declaratie stuurt geen push meer", async () => {
    for (const status of ["approved", "rejected", "concept"]) {
      const { p } = port({ currentDeclaration: async () => ({ status, year: 2026 }) });
      const send = vi.fn();
      expect((await processDeclarationNotification(p, send, "n1")).outcome).toBe("skipped");
      expect(send).not.toHaveBeenCalled();
    }
  });

  it("geen apparaat wordt eerlijk geregistreerd", async () => {
    const { p, finish } = port({ deviceTokens: async () => [] });
    expect((await processDeclarationNotification(p, vi.fn(), "n1")).outcome).toBe("no_devices");
    expect(finish).toHaveBeenCalledWith("n1", { status: "no_devices", sent: 0, total: 0, error: null });
  });

  it("mislukte of niet-ingestelde push wordt 'failed', nooit 'sent'", async () => {
    const { p, finish } = port();
    await processDeclarationNotification(p, async () => ({ ok: false, status: 0, reason: "APNs niet ingesteld" }), "n1");
    expect(finish).toHaveBeenCalledWith("n1", expect.objectContaining({ status: "failed", sent: 0 }));
  });

  it("fout bij lezen wordt 'failed' zonder te gooien", async () => {
    const { p, finish } = port({ deviceTokens: async () => { throw new Error("db"); } });
    expect((await processDeclarationNotification(p, vi.fn(), "n1")).outcome).toBe("failed");
    expect(finish).toHaveBeenCalledWith("n1", expect.objectContaining({ status: "failed" }));
  });

  it("route zonder jaar blijft geldig", () => {
    expect(declarationRoute(DECL)).toBe(`/financien?tab=intern&declaratie=${DECL}`);
  });
});
