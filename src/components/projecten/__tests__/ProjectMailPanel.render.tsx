import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { writeFileSync, mkdirSync } from "node:fs";

const h = vi.hoisted(() => ({ settings: {} as any, sched: {} as any }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (f: unknown) => f }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/projectMail.functions", () => ({ projectMailCheck: vi.fn(), projectMailSetEnabled: vi.fn(), projectMailRunNow: vi.fn(), projectMailSchedulerStatus: async () => h.sched }));
vi.mock("@/integrations/supabase/client", () => {
  const rows: Record<string, any[]> = { project_mail_codes: [{ project_id: "p1", reference_code: "BCD-WORLDLINE", active: true }], projectmail_reviews: [] };
  const q = (t: string): any => {
    const res = { data: rows[t] ?? [], error: null };
    const o: any = { select: () => o, order: () => o, limit: () => o, is: () => o, eq: () => o, maybeSingle: async () => ({ data: h.settings, error: null }), then: (f: any) => Promise.resolve(res).then(f) };
    return o;
  };
  return { supabase: { from: q, rpc: vi.fn() } };
});
import Panel from "../ProjectMail";

const base = { mailbox: "info@coffeeshopbond.nl", enabled: false, connection_state: "verbinding_nodig", connection_detail: "Applicatierecht 'Mail.Read' ontbreekt.", connection_checked_at: "2026-10-23T09:00:00Z", consecutive_failures: 0 };
const mount = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><Panel projects={[{ id: "p1", title: "Worldline — procedures" }]} /></QueryClientProvider>);
afterEach(() => cleanup());

describe("ProjectMailPanel", () => {
  it("niet verbonden: schakelaar uit en geblokkeerd, eerlijke planningstatus", async () => {
    h.settings = base; h.sched = { installed: true, active: false, armed: false, enabled: false };
    const { container } = mount();
    expect(await screen.findByText(/uit tot verbinding geverifieerd/)).toBeTruthy();
    const sw = screen.getByRole("switch", { name: "Automatisch verwerken" });
    expect(sw.getAttribute("aria-checked")).toBe("false");
    expect(sw.hasAttribute("disabled")).toBe(true);
    mkdirSync("/tmp/browser/projectmail", { recursive: true });
    writeFileSync("/tmp/browser/projectmail/panel.html", container.innerHTML);
  });
  it("planning niet geïnstalleerd: alleen handmatig", async () => {
    h.settings = { ...base, connection_state: "verbonden" }; h.sched = { installed: false, active: false, armed: false, enabled: false };
    mount();
    expect(await screen.findByText(/automatische planning niet geïnstalleerd/)).toBeTruthy();
    expect(screen.getByRole("switch", { name: "Automatisch verwerken" }).hasAttribute("disabled")).toBe(true);
  });
  it("instelling 'enabled' zonder actieve job toont nooit 'aan'", async () => {
    h.settings = { ...base, enabled: true, connection_state: "verbonden" }; h.sched = { installed: true, active: false, armed: true, enabled: true };
    mount();
    expect(await screen.findByText(/geïnstalleerd · uit/)).toBeTruthy();
    expect(screen.getByRole("switch", { name: "Automatisch verwerken" }).getAttribute("aria-checked")).toBe("false");
  });
});
