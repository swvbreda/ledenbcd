import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const h = vi.hoisted(() => ({
  auth: { isAdmin: true, loading: false, user: { id: "admin-u" } } as any,
  from: vi.fn(), rpc: vi.fn(), params: new URLSearchParams(), setSp: vi.fn(),
  data: {} as Record<string, any>, fail: new Set<string>(), pending: new Set<string>(),
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => h.auth }));
vi.mock("@/lib/router-compat", () => ({
  Navigate: ({ to }: { to: string }) => <div data-testid="redirect">{to}</div>,
  Link: ({ to, children, ...r }: any) => <a href={to} {...r}>{children}</a>,
  useSearchParams: () => [h.params, h.setSp],
}));
const result = (key: string) => h.pending.has(key) ? new Promise(() => {})
  : Promise.resolve(h.fail.has(key) ? { data: null, error: new Error(key) } : { data: h.data[key] ?? [], error: null });
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (t: string) => { h.from(t); const q: any = { select: () => q, order: () => result(t), then: (a: any, b: any) => result(t).then(a, b) }; return q; },
    rpc: (n: string) => { h.rpc(n); return result(n); },
  },
}));

import VergaderagendaPage from "@/pages/VergaderagendaPage";

const P = (id: string, title: string, status = "actief") => ({ id, title, status, archived_at: null, owner_id: "s1", description: null, project_plan: null });
const wrap = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><VergaderagendaPage /></QueryClientProvider>);

beforeEach(() => {
  h.auth = { isAdmin: true, loading: false, user: { id: "admin-u" } };
  h.from.mockReset(); h.rpc.mockReset(); h.setSp.mockReset();
  h.params = new URLSearchParams(); h.fail = new Set(); h.pending = new Set();
  h.data = {
    internal_projects: [P("p1", "Wietexperiment"), P("p2", "Oud project", "afgerond")],
    internal_tasks: [{ id: "t1", title: "Brief sturen", project_id: "p1", status: "open", deadline: null, assignee_id: "s1" }],
    list_internal_staff_names: [{ user_id: "s1", full_name: "Simone" }],
    dossier_register: [{ id: "d1", parent_id: null, name: "Gemeenten", archived_at: null }],
    dossier_project_links: [{ dossier_id: "d1", project_id: "p1" }],
  };
});
afterEach(cleanup);

describe("Vergaderagenda toegang en status", () => {
  it("niet-admin: redirect zonder enige dataquery", () => {
    h.auth = { isAdmin: false, loading: false, user: { id: "lid" } };
    wrap();
    expect(screen.getByTestId("redirect").textContent).toBe("/");
    expect(h.from).not.toHaveBeenCalled();
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it("auth laden: geen dataquery", () => {
    h.auth = { isAdmin: false, loading: true, user: null };
    wrap();
    expect(screen.getByText("Laden...")).toBeTruthy();
    expect(h.from).not.toHaveBeenCalled();
  });

  it("admin: zes punten, links naar Microsoft-bronnen en project", async () => {
    wrap();
    expect(await screen.findByText("Wietexperiment")).toBeTruthy();
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(6);
    expect(screen.getByText(/BCD Besluitenregister/).closest("a")!.getAttribute("href")).toContain("BCD%20Besluitenregister");
    expect(screen.getByText(/Algemeen > Gedeeld > Vergaderingen > Topical-archief/)).toBeTruthy();
    expect(screen.queryByText(/Notulen en besluiten: Nog niet vastgelegd/)).toBeNull();
  });

  it("dossierregister nog aan het laden: geen agenda tonen", async () => {
    h.pending.add("dossier_project_links");
    wrap();
    await waitFor(() => expect(h.from).toHaveBeenCalledWith("internal_projects"));
    expect(screen.getByText("Laden...")).toBeTruthy();
    expect(screen.queryByText("Wietexperiment")).toBeNull();
  });

  it("fout in dossierkoppelingen: foutmelding en geen schijnbaar complete agenda", async () => {
    h.fail.add("dossier_project_links");
    wrap();
    expect((await screen.findByRole("alert")).textContent).toMatch(/onvolledig/);
    expect(screen.queryByText("Wietexperiment")).toBeNull();
  });

  it("fout in namen: zichtbaar in plaats van stil ontbrekende naam", async () => {
    h.fail.add("list_internal_staff_names");
    wrap();
    expect((await screen.findByRole("alert")).textContent).toMatch(/Namen van verantwoordelijken/);
    expect(screen.getAllByText(/Naam niet geladen/).length).toBeGreaterThan(0);
  });

  it("verouderd project in URL: ongeldige selectie, geen verbreding", async () => {
    h.params = new URLSearchParams("project=weg");
    wrap();
    expect((await screen.findByRole("alert")).textContent).toMatch(/Ongeldige selectie/);
    expect(screen.queryByText("Wietexperiment")).toBeNull();
    expect(screen.queryByText(/Projectvoortgang/)).toBeNull();
  });

  it("project én dossier in URL: beide in filterregel", async () => {
    h.params = new URLSearchParams("project=p1&dossier=d1");
    wrap();
    expect(await screen.findByText("Filter: project Wietexperiment en dossier Gemeenten")).toBeTruthy();
  });
});
