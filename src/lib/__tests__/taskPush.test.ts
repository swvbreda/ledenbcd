import { describe, expect, it, vi } from "vitest";
import { processTaskNotification, PUSH_BODY, PUSH_TITLE, taskRoute, type TaskPushPort } from "@/lib/taskPush";

const ADMIN = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";
const TASK = "33333333-3333-3333-3333-333333333333";

function port(over: Partial<TaskPushPort> = {}) {
  let claimed = false;
  const finish = vi.fn(async (_id: string, _r: unknown) => {});
  const p: TaskPushPort = {
    claim: async (id) => (claimed ? null : ((claimed = true), { id, recipient_id: ADMIN, task_id: TASK, push_attempts: 1 })),
    isAdmin: async (u) => u === ADMIN,
    currentTask: async () => ({ assignee_id: ADMIN, status: "te_doen" }),
    deviceTokens: async () => ["aa", "bb"],
    finish,
    removeInvalidTokens: vi.fn(async () => {}),
    ...over,
  };
  return { p, finish };
}

describe("taakpush", () => {
  it("stuurt generieke tekst en alleen taskId in route naar ontvanger", async () => {
    const { p, finish } = port();
    const send = vi.fn(async () => ({ ok: true, status: 200 }));
    const r = await processTaskNotification(p, send, "n1");
    expect(r.outcome).toBe("sent");
    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenCalledWith("aa", { title: PUSH_TITLE, body: PUSH_BODY, route: taskRoute(TASK) });
    expect(PUSH_TITLE).toBe("Nieuwe taak toegewezen");
    expect(finish).toHaveBeenCalledWith("n1", { status: "sent", sent: 2, total: 2, error: null });
  });

  it("dubbele verwerking (retry) stuurt niet opnieuw", async () => {
    const { p } = port();
    const send = vi.fn(async () => ({ ok: true, status: 200 }));
    await processTaskNotification(p, send, "n1");
    const second = await processTaskNotification(p, send, "n1");
    expect(second.outcome).toBe("not_claimed");
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("oude ontvanger na herverdeling krijgt geen push", async () => {
    const { p, finish } = port({ currentTask: async () => ({ assignee_id: OTHER, status: "te_doen" }) });
    const send = vi.fn();
    expect((await processTaskNotification(p, send, "n1")).outcome).toBe("skipped");
    expect(send).not.toHaveBeenCalled();
    expect(finish.mock.calls[0]?.[1]).toMatchObject({ status: "skipped" });
  });

  it("ontvanger zonder adminrol krijgt geen push", async () => {
    const { p } = port({ isAdmin: async () => false });
    const send = vi.fn();
    expect((await processTaskNotification(p, send, "n1")).outcome).toBe("skipped");
    expect(send).not.toHaveBeenCalled();
  });

  it("geen apparaten wordt eerlijk geregistreerd", async () => {
    const { p, finish } = port({ deviceTokens: async () => [] });
    expect((await processTaskNotification(p, vi.fn(), "n1")).outcome).toBe("no_devices");
    expect(finish).toHaveBeenCalledWith("n1", { status: "no_devices", sent: 0, total: 0, error: null });
  });

  it("telt successen nauwkeurig en markeert mislukking als herhaalbaar", async () => {
    const { p, finish } = port();
    const send = vi.fn(async (t: string) => (t === "aa" ? { ok: true, status: 200 } : { ok: false, status: 500 }));
    await processTaskNotification(p, send, "n1");
    expect(finish.mock.calls[0]?.[1]).toMatchObject({ status: "sent", sent: 1, total: 2 });
    const { p: p2, finish: f2 } = port();
    await processTaskNotification(p2, async () => ({ ok: false, status: 503 }), "n2");
    expect(f2.mock.calls[0]?.[1]).toMatchObject({ status: "failed", sent: 0 });
  });

  it("ongeldige tokens worden alleen bij de ontvanger verwijderd", async () => {
    const { p } = port();
    await processTaskNotification(p, async () => ({ ok: false, status: 410, reason: "Unregistered" }), "n1");
    expect(p.removeInvalidTokens).toHaveBeenCalledWith(ADMIN, ["aa", "bb"]);
  });
});

describe("ontbrekende verzender", () => {
  it("claimt nooit 'sent' als APNs niet ingesteld is", async () => {
    const { p, finish } = port();
    await processTaskNotification(p, async () => ({ ok: false, status: 0, reason: "APNs niet ingesteld" }), "n1");
    expect(finish.mock.calls[0]?.[1]).toMatchObject({ status: "failed", sent: 0 });
  });
});
