import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

let auth: any;
let search = new URLSearchParams();
let dataError = false;
const rpc = vi.fn();
const from = vi.fn();
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc, from } }));
vi.mock("@/lib/router-compat", () => ({ useSearchParams: () => [search], useNavigate: () => vi.fn() }));
const member = { id: 1, naam: "Actief lid", plaats: "Amsterdam", aantalLocaties: 1, locaties: [], contacten: [], contactpersoon: "", bedrijfsnaam: "" };
const lead = { ...member, id: 2, naam: "Verborgen prospect", aantalLocaties: 9 };
vi.mock("@/contexts/MembersDataContext", () => ({ useMembersData: () => ({
  rawMembers: [member], rawLeads: [lead], rawOldMembers: [], isLoading: false, isError: dataError, refetch: vi.fn(),
}) }));
vi.mock("@/hooks/useMemberEdits", () => ({ useMergedMembers: (members: unknown[]) => ({ members }) }));
vi.mock("@/components/BcdHeroBanner", () => ({ default: ({ title, subtitle }: any) => <header><h1>{title}</h1><p>{subtitle}</p></header> }));
vi.mock("@/components/MemberTable", () => ({ default: ({ members }: any) => <div>{members.map((m: any) => <p key={m.id}>{m.naam}</p>)}</div> }));
vi.mock("@/components/CoffeeshopTable", () => ({ default: ({ members }: any) => <div>{members.map((m: any) => <p key={m.id}>{m.naam}</p>)}</div> }));
vi.mock("@/components/MemberFilters", () => ({ default: () => null }));
vi.mock("@/components/ExportButton", () => ({ default: () => null }));
vi.mock("@/components/MailingExportButton", () => ({ default: () => null }));
vi.mock("@/components/NewMemberDialog", () => ({ default: () => null }));

import LedenPage from "@/pages/LedenPage";
import { useLeadConversions } from "@/hooks/useLeadConversions";

function Conversions() {
  const { conversions } = useLeadConversions();
  return <div>{conversions.map((c) => <p key={c.id}>{c.lead_id}</p>)}</div>;
}
const wrap = (ui: React.ReactElement, qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })) =>
  render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
beforeEach(() => {
  auth = { user: { id: "member" }, loading: false, isAdmin: false, isBoard: false, isInhuur: false };
  search = new URLSearchParams(); dataError = false; from.mockReset(); rpc.mockReset();
});
afterEach(cleanup);
describe("ordinary member directory", () => {
  it.each(["", "tab=leads", "tab=coffeeshops"])("excludes leads even from stale privileged data: %s", (query) => {
    search = new URLSearchParams(query);
    wrap(<LedenPage />);
    expect(screen.getByText("Actief lid")).toBeTruthy();
    expect(screen.queryByText("Verborgen prospect")).toBeNull();
    expect(screen.queryByRole("tab", { name: /Leads/ })).toBeNull();
    expect(from).not.toHaveBeenCalled();
  });
  it("internal member total counts one member, not one member plus one lead", async () => {
    auth.isAdmin = true;
    from.mockReturnValue({ select: () => Promise.resolve({ data: [], error: null }) });
    wrap(<LedenPage />);
    expect(screen.getByText("1 leden")).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Leden (1)" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Leads (1)" })).toBeTruthy();
  });
  it("failed directory reads never display a partial member total", () => {
    dataError = true;
    wrap(<LedenPage />);
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.queryByRole("tab", { name: /Leden/ })).toBeNull();
  });
  it("account switch cannot expose cached lead conversions", async () => {
    auth.isAdmin = true;
    from.mockReturnValue({ select: () => Promise.resolve({ data: [{ id: "c1", lead_id: 987 }], error: null }) });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = wrap(<Conversions />, qc);
    await screen.findByText("987");
    from.mockClear();
    auth = { ...auth, user: { id: "member2" }, isAdmin: false };
    view.rerender(<QueryClientProvider client={qc}><Conversions /></QueryClientProvider>);
    await waitFor(() => expect(screen.queryByText("987")).toBeNull());
    expect(from).not.toHaveBeenCalled();
  });
  it("does not request conversions before authentication has resolved", () => {
    auth.isAdmin = true; auth.loading = true;
    wrap(<Conversions />);
    expect(from).not.toHaveBeenCalled();
  });
});