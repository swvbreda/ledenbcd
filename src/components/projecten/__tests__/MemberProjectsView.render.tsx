import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const rpc = vi.fn();
const from = vi.fn(() => { throw new Error("directe tabeltoegang verboden"); });
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a), from: (...a: unknown[]) => from(...(a as [])) } }));

let auth: any;
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));

let search = new URLSearchParams();
vi.mock("@/lib/router-compat", () => ({
  useSearchParams: () => [search, (fn: any) => { search = typeof fn === "function" ? fn(search) : new URLSearchParams(fn); }],
  Navigate: ({ to }: { to: string }) => <div data-testid="navigate">{to}</div>,
}));
// Beheeronderdelen mogen nooit nodig zijn voor de ledenweergave.
vi.mock("@tanstack/react-start", () => ({ useServerFn: () => vi.fn(() => Promise.resolve()) }));
vi.mock("@/lib/taskNotifications.functions", () => ({ dispatchTaskPushes: {} }));
vi.mock("@/components/projecten/PlannerPanel", () => ({ default: () => null }));
vi.mock("@/components/projecten/TopicalPanel", () => ({ default: () => null }));

import MemberProjectsView, { memberProjectsKey } from "../MemberProjectsView";
import ProjectenPage from "@/pages/ProjectenPage";

const member = (id = "u-member") => ({ user: { id }, loading: false, isAdmin: false, isExtern: false, isInhuur: false, linkedMemberId: 7 });
const rows = [
  { id: "p1", title: "Amsterdam i-criterium", status: "actief", status_date: "2026-10-06", description: "Brief verstuurd.",
    timeline: [{ date: "2025-01-05", title: "Oud", text: "a" }, { date: "2026-03-01", title: "Nieuw", text: "b" }] },
  { id: "p2", title: "Leeg project", status: "actief", status_date: null, description: null, timeline: [] },
];
const wrap = (ui: React.ReactElement, qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })) =>
  render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);

beforeEach(() => { rpc.mockReset(); from.mockClear(); search = new URLSearchParams(); auth = member(); });
afterEach(cleanup);

describe("MemberProjectsView", () => {
  it("laadt alleen via de smalle RPC en toont lijst zonder beheeracties", async () => {
    rpc.mockResolvedValue({ data: rows, error: null });
    wrap(<MemberProjectsView />);
    expect(screen.getByText("Projecten laden...")).toBeTruthy();
    expect(await screen.findByText("Amsterdam i-criterium")).toBeTruthy();
    expect(rpc).toHaveBeenCalledWith("get_member_project_status");
    expect(from).not.toHaveBeenCalled();
    for (const n of [/Nieuw project/, /bewerken/i, /Afronden/, /archiveren/i, /Ledenweergave/]) expect(screen.queryByRole("button", { name: n })).toBeNull();
    expect(screen.getByText("Statusdatum niet vastgelegd")).toBeTruthy();
  });
  it("foutmelding met Opnieuw", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "not authorized" } });
    wrap(<MemberProjectsView />);
    expect(await screen.findByText("De projecten konden niet worden geladen.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Opnieuw" })).toBeTruthy();
  });
  it("lege lijst eerlijk", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    wrap(<MemberProjectsView />);
    expect(await screen.findByText("Er zijn nog geen projecten.")).toBeTruthy();
  });
  it("deeplink: één Huidige status en Verloop nieuwste eerst", async () => {
    search = new URLSearchParams("project=p1");
    rpc.mockResolvedValue({ data: rows, error: null });
    wrap(<MemberProjectsView />);
    expect(await screen.findByText("Huidige status")).toBeTruthy();
    expect(screen.getAllByText("Huidige status")).toHaveLength(1);
    const items = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(items[0]).toContain("Nieuw");
    expect(items[1]).toContain("Oud");
    expect(screen.getByText("Stand per 6 oktober 2026")).toBeTruthy();
  });
  it("leeg verloop en onbekend project", async () => {
    search = new URLSearchParams("project=p2");
    rpc.mockResolvedValue({ data: rows, error: null });
    const { unmount } = wrap(<MemberProjectsView />);
    expect(await screen.findByText("Nog geen verloop vastgelegd.")).toBeTruthy();
    unmount();
    search = new URLSearchParams("project=bestaat-niet");
    wrap(<MemberProjectsView />);
    expect(await screen.findByText("Dit project bestaat niet (meer) of is niet beschikbaar.")).toBeTruthy();
  });
  it("cache per gebruiker: tweede account ziet nooit resultaten van eerste", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    rpc.mockResolvedValueOnce({ data: rows, error: null });
    const { unmount } = wrap(<MemberProjectsView />, qc);
    await screen.findByText("Amsterdam i-criterium");
    unmount();
    expect(memberProjectsKey("a")).not.toEqual(memberProjectsKey("b"));
    auth = member("u-former");
    rpc.mockResolvedValueOnce({ data: null, error: { message: "not authorized" } });
    wrap(<MemberProjectsView />, qc);
    expect(await screen.findByText("De projecten konden niet worden geladen.")).toBeTruthy();
    expect(screen.queryByText("Amsterdam i-criterium")).toBeNull();
  });
  it("geen RPC zonder ingelogde gebruiker", async () => {
    auth = { user: null, loading: false };
    wrap(<MemberProjectsView />);
    await new Promise((r) => setTimeout(r, 20));
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("ProjectenPage routering", () => {
  it("gekoppeld lid krijgt alleen-lezen ledenweergave, geen beheerqueries", async () => {
    rpc.mockResolvedValue({ data: rows, error: null });
    wrap(<ProjectenPage />);
    expect(await screen.findByRole("heading", { name: "Projecten" })).toBeTruthy();
    expect(from).not.toHaveBeenCalled();
    expect(rpc.mock.calls.every((c) => c[0] === "get_member_project_status")).toBe(true);
  });
  it.each([
    ["extern", { ...member(), isExtern: true }],
    ["inhuur", { ...member(), isInhuur: true }],
    ["niet gekoppeld", { ...member(), linkedMemberId: null }],
  ])("%s wordt weggestuurd", async (_n, a) => {
    auth = a;
    wrap(<ProjectenPage />);
    expect(screen.getByTestId("navigate").textContent).toBe("/");
    await waitFor(() => expect(rpc).not.toHaveBeenCalled());
  });
  it("beheerder: Ledenweergave toont dezelfde smalle weergave", async () => {
    auth = { ...member("u-admin"), isAdmin: true };
    search = new URLSearchParams("weergave=leden");
    rpc.mockResolvedValue({ data: rows, error: null });
    wrap(<ProjectenPage />);
    expect(await screen.findByText("Voorbeeld: zo zien leden deze pagina.")).toBeTruthy();
    expect(from).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Terug naar beheer" }));
    expect(search.get("weergave")).toBeNull();
  });
});
