import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const PIN = "AAMkADk4Y2RiODc2LWE0MmItNGYwNS1iY2ExLTRhMzk2NzI4YmJhZQBGAAAAAAD9HfbZJGsFTZ4QRq02J-rOBwBBtJIYhrAZQJ4MRFt3l07ZAAAAAAEGAABBtJIYhrAZQJ4MRFt3l07ZAAFd2lnmAAA=";
const h = vi.hoisted(() => ({ list: vi.fn(), confirm: vi.fn(), bucket: vi.fn(), run: vi.fn(), success: vi.fn(), warning: vi.fn(), error: vi.fn(), settings: {} as any }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "admin-1" } }) }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (f: unknown) => f }));
vi.mock("sonner", () => ({ toast: { success: h.success, warning: h.warning, error: h.error } }));
vi.mock("@/lib/msImport.functions", () => ({ msImportListCalendars: h.list, msImportConfirmCalendar: h.confirm, msImportSetGeneralBucket: h.bucket, msImportRunNow: h.run }));
vi.mock("@/integrations/supabase/client", () => {
  const rows: Record<string, any[]> = {
    ms_planner_unprocessed: [{ planner_task_id: "p1", title: "Copilot aanvragen", due: null, percent: 0, assignee_count: 0, source_state: "present" }],
    ms_import_conflicts: [{ id: "c1", source: "agenda", reason: "bestaand_app_item", created_at: "2026-10-21T10:00:00Z" }],
    ms_import_runs: [],
  };
  const q = (t: string): any => {
    const res = { data: rows[t] ?? [], count: 0, error: null };
    const o: any = { select: () => o, order: () => o, limit: () => o, is: () => o, maybeSingle: async () => ({ data: h.settings, error: null }), then: (f: any) => Promise.resolve(res).then(f) };
    return o;
  };
  return { supabase: { from: q } };
});
import Panel, { type MsImportSettingsView } from "../MsImportPanel";

const base: MsImportSettingsView = { enabled: false, release_gate: false, agenda_mailbox: "simone@coffeeshopbond.nl", agenda_calendar_id: null, agenda_calendar_name: null, agenda_confirmed_at: null, planner_mode: "import", planner_general_bucket_id: null, planner_general_bucket_name: null };
const mount = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><Panel buckets={[]} /></QueryClientProvider>);
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("MsImportPanel", () => {
  it("toont onverwerkte taken en review-items als lijst", async () => {
    h.settings = base; mount();
    expect(await screen.findByText("Copilot aanvragen")).toBeTruthy();
    expect(screen.getByText(/niet dubbel geïmporteerd/)).toBeTruthy();
  });
  it("biedt alleen de vastgezette BCD-agenda aan", async () => {
    h.settings = base;
    h.list.mockResolvedValue({ ok: true, mailbox: "x", calendars: [{ id: "OTHER", name: "BCD", selectable: true }, { id: "DEF", name: "Agenda", selectable: false }] });
    mount(); fireEvent.click(await screen.findByRole("button", { name: "Agenda's ophalen" }));
    expect(await screen.findByText(/niet gevonden in deze postbus/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Deze agenda bevestigen" })).toBeNull();
  });
  it("bevestigt de vastgezette agenda op exact id", async () => {
    h.settings = base; h.confirm.mockResolvedValue({ ok: true, name: "BCD" });
    h.list.mockResolvedValue({ ok: true, mailbox: "x", calendars: [{ id: PIN, name: "BCD", selectable: true }] });
    mount(); fireEvent.click(await screen.findByRole("button", { name: "Agenda's ophalen" }));
    fireEvent.click(await screen.findByRole("button", { name: "Deze agenda bevestigen" }));
    await waitFor(() => expect(h.confirm).toHaveBeenCalledWith({ data: { calendarId: PIN } }));
  });
  it("aan + release maar geen uurtrigger: niet 'aan' tonen", async () => {
    h.settings = { ...base, enabled: true, release_gate: true }; mount();
    expect(await screen.findByText(/niet mogelijk — er is nog geen uurtrigger/)).toBeTruthy();
    expect(screen.queryByText("Automatisch elk uur: aan.")).toBeNull();
  });
  it("onvolledige import geeft geen succesmelding", async () => {
    h.settings = base; vi.spyOn(window, "confirm").mockReturnValue(true);
    h.run.mockResolvedValue({ agenda: { status: "partial", detail: "403", counts: null }, planner: [], plannerSkipped: "Geen gekoppelde buckets" });
    mount(); fireEvent.click(await screen.findByRole("button", { name: /Nu importeren/ }));
    await waitFor(() => expect(h.warning).toHaveBeenCalled()); expect(h.success).not.toHaveBeenCalled();
  });
});
