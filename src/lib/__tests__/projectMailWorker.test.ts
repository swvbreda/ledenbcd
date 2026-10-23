import { describe, expect, it, vi } from "vitest";
import { handleScheduledProjectMail, runProjectMailLogged, saveConnection, verifyMailAccess, RUN_BUDGET_MS, LEASE_SECONDS } from "@/lib/projectMailWorker.server";
import { RunDeadlineError, runProjectMail, type MailDb, type MailGraph } from "@/lib/projectMail";

const UID = "069ed1f9-ab7f-48bf-a5f8-500e7b40ccad";

describe("verifyMailAccess", () => {
  it("Mail.ReadBasic.All volstaat niet en leest niets", async () => {
    const get = vi.fn();
    const r = await verifyMailAccess(["Mail.ReadBasic.All", "User.Read.All"], get, UID);
    expect(r.state).toBe("verbinding_nodig");
    expect(get).not.toHaveBeenCalled();
  });
  it("Mail.Read + echte GET van één bericht-body → verbonden, body niet in resultaat", async () => {
    const get = vi.fn(async (p: string) => p.includes("$top=1") ? { json: { value: [{ id: "AAMkAD123456" }] } } : { json: { body: { content: "GEHEIM" } } });
    const r = await verifyMailAccess(["Mail.Read"], get, UID);
    expect(r.state).toBe("verbonden");
    expect(get).toHaveBeenCalledTimes(2);
    expect(get.mock.calls[1][0]).toBe(`/users/${UID}/messages/AAMkAD123456?$select=body`);
    expect(JSON.stringify(r)).not.toContain("GEHEIM");
  });
  it("lege inbox: rol + lijst bewijzen toegang", async () => {
    const r = await verifyMailAccess(["Mail.ReadWrite"], async () => ({ json: { value: [] } }), UID);
    expect(r.state).toBe("verbonden");
    expect(r.detail).toMatch(/leeg/);
  });
  it("403 op body → verbinding nodig", async () => {
    const get = async (p: string) => { if (p.includes("$top=1")) return { json: { value: [{ id: "AAMkAD123456" }] } }; throw new Error("Graph 403 ErrorAccessDenied"); };
    expect((await verifyMailAccess(["Mail.Read"], get, UID)).state).toBe("verbinding_nodig");
  });
  it("403 op lijst (toegangsbeleid sluit postbus uit) → verbinding nodig", async () => {
    expect((await verifyMailAccess(["Mail.Read"], async () => { throw new Error("403"); }, UID)).state).toBe("verbinding_nodig");
  });
});

function fakeSb(opts: { acquire?: boolean; acquireErr?: boolean; updateErr?: boolean; enabled?: boolean; armed?: boolean; wakeOk?: boolean } = {}) {
  const calls: { rpc: string[]; updates: any[] } = { rpc: [], updates: [] };
  const q: any = {
    insert: () => q, select: () => q, single: async () => ({ data: { id: "run1" }, error: null }),
    maybeSingle: async () => ({ data: { enabled: opts.enabled ?? true, scheduler_armed: opts.armed ?? true, connection_state: "verbonden", updated_by: "admin1", consecutive_failures: 0 }, error: null }),
    update: (p: any) => { calls.updates.push(p); return { eq: () => ({ ...Promise.resolve({ error: opts.updateErr ? { message: "db down" } : null }), then: (r: any) => r({ error: opts.updateErr ? { message: "db down" } : null }) }) }; },
  };
  const sb = {
    from: () => q,
    rpc: async (name: string) => {
      calls.rpc.push(name);
      if (name === "projectmail_acquire") return opts.acquireErr ? { data: null, error: { message: "x" } } : { data: opts.acquire ?? true, error: null };
      if (name === "projectmail_consume_wake") return { data: opts.wakeOk ?? false, error: null };
      if (name === "has_role") return { data: true, error: null };
      return { data: null, error: null };
    },
  };
  return { sb, calls };
}

describe("lease en deadline", () => {
  it("runbudget ruim korter dan lease", () => expect(RUN_BUDGET_MS).toBeLessThan(LEASE_SECONDS * 1000 - 60_000));
  it("bezette lease → busy, geen release van andermans lease", async () => {
    const { sb, calls } = fakeSb({ acquire: false });
    expect((await runProjectMailLogged(sb, "a", "manual", {})).status).toBe("busy");
    expect(calls.rpc).not.toContain("projectmail_release");
  });
  it("lease-RPC fout → fout, niet stil doorgaan", async () => {
    const { sb } = fakeSb({ acquireErr: true });
    expect((await runProjectMailLogged(sb, "a", "manual", {})).status).toBe("fout");
  });
  it("runProjectMail stopt bij deadline zonder poging te tellen of checkpoint op te schuiven", async () => {
    let t = 0; const begin = vi.fn(); const save = vi.fn();
    const g: MailGraph = { delta: async () => ({ items: [{ id: "m1", subject: "[BCD-WORLDLINE]", receivedDateTime: "" }], next: null, delta: "$deltatoken=a" }), body: async () => "" };
    const db = { codes: async () => [{ project_id: "P", reference_code: "BCD-WORLDLINE", active: true, archived: false }], checkpoint: async () => null, saveCheckpoint: save, beginMessage: begin } as unknown as MailDb;
    const clock = () => (t += 600);
    await expect(runProjectMail(g, db, async () => ({}), new Date(), 1500, clock)).rejects.toBeInstanceOf(RunDeadlineError);
    expect(begin).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });
  it("deadline in gelogde run → fout geregistreerd en lease vrijgegeven", async () => {
    const { sb, calls } = fakeSb();
    let t = 0;
    const g: MailGraph = { delta: async () => ({ items: [], next: "$skiptoken=b", delta: null }), body: async () => "" };
    const r = await runProjectMailLogged(sb, "a", "manual", {}, { graph: g, extract: async () => ({}) }, () => (t++ === 0 ? 0 : RUN_BUDGET_MS + 1));
    expect(r.status).toBe("fout");
    expect(r.error).toMatch(/runduur/);
    expect(calls.rpc).toContain("projectmail_release");
  });
  it("saveConnection gooit bij DB-fout en zet bij niet-verbonden ook planning uit", async () => {
    const bad = fakeSb({ updateErr: true });
    await expect(saveConnection(bad.sb, { state: "verbinding_nodig", detail: "x" })).rejects.toThrow(/niet opgeslagen/);
    const ok = fakeSb();
    await saveConnection(ok.sb, { state: "verbinding_nodig", detail: "x" });
    expect(ok.calls.updates[0]).toMatchObject({ enabled: false, scheduler_armed: false });
  });
});

describe("geplande aanroep", () => {
  const req = (h: Record<string, string>) => new Request("https://x/api/public/projectmail-pull", { method: "POST", headers: h });
  it("zonder sleutel of wektoken → 401", async () => {
    expect((await handleScheduledProjectMail(req({}), {}, async () => fakeSb().sb)).status).toBe(401);
  });
  it("onbekende/gebruikte wektoken → 401", async () => {
    expect((await handleScheduledProjectMail(req({ "x-projectmail-wake": "a".repeat(64) }), {}, async () => fakeSb({ wakeOk: false }).sb)).status).toBe(401);
  });
  it("geldige wektoken maar niet armed → overslaan", async () => {
    const r = await handleScheduledProjectMail(req({ "x-projectmail-wake": "a".repeat(64) }), {}, async () => fakeSb({ wakeOk: true, armed: false }).sb);
    expect(await r.json()).toMatchObject({ skipped: "disabled" });
  });
});
