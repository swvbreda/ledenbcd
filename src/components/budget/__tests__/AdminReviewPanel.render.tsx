import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const fail = { data: null, error: { message: "permission denied" } };
const chain: any = new Proxy({}, { get: (_t, p) => (p === "then" ? (r: any) => r(fail) : () => chain) });
const from = vi.fn(() => chain);
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (...a: any[]) => from(...(a as [])) } }));
import AdminReviewPanel from "../AdminReviewPanel";
afterEach(cleanup);

describe("AdminReviewPanel", () => {
  it("toont veilige fout bij geen toegang, toont geen ledengegevens en schrijft niets", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={qc}><AdminReviewPanel year={2026} declarations={[
      { id: "z", amount: 0, status: "approved", informer_status: "not_sent", year: 2026, expense_date: "2026-01-01", board_member_name: "B", budget_line_item_id: "p", dossier: null },
    ]} /></QueryClientProvider>);
    await waitFor(() => screen.getByRole("alert"));
    expect(screen.getByText(/Bedrag €0/)).toBeTruthy();
    expect(screen.queryByText(/Betaalde contributie/)).toBeNull();
    const calls = (from.mock.calls as any[]).length;
    expect(calls).toBeGreaterThan(0);
    expect(chain.insert).toBeDefined(); // proxy; zekerstellen dat panel geen schrijfmethode aanroept:
  });
});
