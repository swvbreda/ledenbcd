import { describe, expect, it, vi } from "vitest";
import { DECL_PUSH_BODY, DECL_PUSH_TITLE, declarationRoute, runDeclarationPushBatch, type DeclClaim, type DeclarationPushPort } from "@/lib/declarationPush";
import { handleDeclarationPushSchedule } from "@/lib/declarationPush.server";

const SIMONE = "a7fce7fa-600b-48ef-8faf-7aea6918660a";
const BERNARD = "15adafb2-cb6a-4212-8604-68d27814ba59";
const OTHER_ADMIN = "22222222-2222-2222-2222-222222222222";
const DECL = "33333333-3333-3333-3333-333333333333";

function port(over: Partial<DeclarationPushPort> = {}, recipient = BERNARD) {
  let claimed = false;
  const c: DeclClaim = { id: "n1", recipient_id: recipient, declaration_id: DECL, push_attempts: 1, lock_token: "lk" };
  const finish = vi.fn(async () => true);
  const p: DeclarationPushPort = {
    claim: async () => (claimed ? [] : ((claimed = true), [c])),
    recipients: async () => [SIMONE, BERNARD],
    currentDeclaration: async () => ({ status: "pending", year: 2026 }),
    deviceTokens: async () => ["aa"],
    finish,
    removeInvalidTokens: vi.fn(async () => {}),
    ...over,
  };
  return { p, finish, c };
}
const outcome = async (p: DeclarationPushPort, send: any) => (await runDeclarationPushBatch(p, send)).results[0]?.outcome;

describe("declaratiepush", () => {
  it("lockscreen zonder bedragen/namen en route naar de juiste declaratie", async () => {
    const { p } = port();
    const send = vi.fn(async () => ({ ok: true, status: 200 }));
    expect(await outcome(p, send)).toBe("sent");
    expect(send).toHaveBeenCalledWith("aa", { title: DECL_PUSH_TITLE, body: DECL_PUSH_BODY, route: `/financien?tab=intern&year=2026&declaratie=${DECL}` });
    expect(`${DECL_PUSH_TITLE} ${DECL_PUSH_BODY}`).not.toMatch(/€|\d/);
  });

  it("tweede run zonder claim stuurt niet opnieuw", async () => {
    const { p } = port();
    const send = vi.fn(async () => ({ ok: true, status: 200 }));
    await runDeclarationPushBatch(p, send);
    expect((await runDeclarationPushBatch(p, send)).processed).toBe(0);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("andere beheerder krijgt nooit push", async () => {
    const { p, finish } = port({}, OTHER_ADMIN);
    const send = vi.fn();
    expect(await outcome(p, send)).toBe("skipped");
    expect(send).not.toHaveBeenCalled();
    expect(finish).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ status: "skipped" }));
  });

  it("goedkeurder die rechten verloor krijgt geen push", async () => {
    const { p } = port({ recipients: async () => [SIMONE] });
    const send = vi.fn();
    expect(await outcome(p, send)).toBe("skipped");
    expect(send).not.toHaveBeenCalled();
  });

  it("niet meer ingediende declaratie stuurt geen push", async () => {
    for (const status of ["approved", "rejected", "concept"]) {
      const { p } = port({ currentDeclaration: async () => ({ status, year: 2026 }) });
      const send = vi.fn();
      expect(await outcome(p, send)).toBe("skipped");
      expect(send).not.toHaveBeenCalled();
    }
  });

  it("geen apparaat wordt eerlijk geregistreerd", async () => {
    const { p, finish } = port({ deviceTokens: async () => [] });
    expect(await outcome(p, vi.fn())).toBe("no_devices");
    expect(finish).toHaveBeenCalledWith(expect.anything(), { status: "no_devices", sent: 0, total: 0, error: null });
  });

  it("geweigerde of niet-ingestelde push wordt 'failed' (retrybaar), nooit 'sent'", async () => {
    const { p, finish } = port();
    await runDeclarationPushBatch(p, async () => ({ ok: false, status: 0, reason: "APNs niet ingesteld" }));
    expect(finish).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ status: "failed", sent: 0 }));
  });

  it("netwerkfout tijdens verzenden wordt 'unknown', niet 'failed'", async () => {
    const { p, finish } = port();
    expect(await outcome(p, async () => { throw new Error("timeout"); })).toBe("unknown");
    expect(finish).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ status: "unknown" }));
  });

  it("leesfout vóór verzenden wordt 'failed' zonder te gooien", async () => {
    const { p, finish } = port({ deviceTokens: async () => { throw new Error("db"); } });
    const send = vi.fn();
    expect(await outcome(p, send)).toBe("failed");
    expect(send).not.toHaveBeenCalled();
    expect(finish).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ status: "failed" }));
  });

  it("verlopen lease (stale) en databasefout bij afronden worden eerlijk gemeld", async () => {
    expect(await outcome(port({ finish: async () => false }).p, async () => ({ ok: true, status: 200 }))).toBe("stale");
    expect(await outcome(port({ finish: async () => { throw new Error("db"); } }).p, async () => ({ ok: true, status: 200 }))).toBe("finish_error");
  });

  it("finish krijgt de lease-token van de claim", async () => {
    const { p, finish, c } = port();
    await runDeclarationPushBatch(p, async () => ({ ok: true, status: 200 }));
    expect(finish).toHaveBeenCalledWith(c, expect.anything());
  });

  it("interne wekker-route weigert zonder of met fout geheim, vóór database", async () => {
    const load = vi.fn();
    const env = { INTERNAL_WEBHOOK_SECRET: "geheim-fixture" };
    const mk = (h?: string) => new Request("http://x", { method: "POST", headers: h ? { "x-internal-secret": h } : {} });
    expect((await handleDeclarationPushSchedule(mk(), env, load)).status).toBe(401);
    expect((await handleDeclarationPushSchedule(mk("fout"), env, load)).status).toBe(401);
    expect((await handleDeclarationPushSchedule(mk("x"), {}, load)).status).toBe(401);
    expect(load).not.toHaveBeenCalled();
  });

  it("route zonder jaar blijft geldig", () => {
    expect(declarationRoute(DECL)).toBe(`/financien?tab=intern&declaratie=${DECL}`);
  });
});
