// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const calls: any[] = [];
let rows: any[] = [{ id: "d1" }];
const invoke = vi.fn(async () => ({ data: { success: true }, error: null }));
vi.mock("@/integrations/supabase/client", () => {
  const chain = (): any => {
    const q: any = {};
    for (const m of ["update", "insert", "eq", "is", "in", "select"]) q[m] = (...a: any[]) => { calls.push([m, ...a]); return q; };
    q.then = (cb: any) => cb({ data: rows, error: null });
    return q;
  };
  return { supabase: { from: () => chain(), functions: { invoke }, auth: { getSession: async () => ({ data: { session: { user: { id: "u1" } } } }) }, storage: { from: () => ({ upload: async () => ({ error: null }) }) } } };
});
import { useInternalDeclarationMutations } from "@/hooks/useInternalDeclarations";

const wrap = ({ children }: { children: ReactNode }) => <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
const fields: any = { board_member_id: "b1", board_member_name: "S", declaration_type: "reiskosten", appointment: "x", trajectory: "A – B",
  km_single: 93, km_return: 186, km_rate: 0.23, amount: 42.78, expense_date: "2026-08-25", bank_account: "NL", account_holder: "S", event_id: null };

beforeEach(() => { calls.length = 0; rows = [{ id: "d1" }]; invoke.mockClear(); });

describe("edit-mutatie", () => {
  it("doet een voorwaardelijke UPDATE op hetzelfde id, geen INSERT en geen Informer-aanroep", async () => {
    const { result } = renderHook(() => useInternalDeclarationMutations(2026), { wrapper: wrap });
    const r = await result.current.edit.mutateAsync({ id: "d1", expectedStatus: "approved", fields, existingReceipts: ["a.pdf"] });
    expect(r).toMatchObject({ id: "d1", submitted: false });
    expect(calls.some((c) => c[0] === "insert")).toBe(false);
    const upd = calls.find((c) => c[0] === "update")!;
    expect(upd[1]).toMatchObject({ amount: 42.78, receipt_paths: ["a.pdf"] });
    expect("status" in upd[1]).toBe(false);
    expect(calls).toContainEqual(["eq", "id", "d1"]);
    expect(calls).toContainEqual(["eq", "status", "approved"]);
    expect(calls).toContainEqual(["is", "paid_at", null]);
    expect(calls).toContainEqual(["is", "bank_transaction_id", null]);
    expect(calls).toContainEqual(["is", "informer_external_id", null]);
    expect(calls).toContainEqual(["in", "informer_status", ["not_sent", "error"]]);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("0 rijen (intussen verstuurd/betaald) geeft een fout, geen stil succes", async () => {
    rows = [];
    const { result } = renderHook(() => useInternalDeclarationMutations(2026), { wrapper: wrap });
    await expect(result.current.edit.mutateAsync({ id: "d1", expectedStatus: "pending", fields, existingReceipts: [] })).rejects.toThrow(/intussen/);
  });

  it("concept opslaan en indienen: zelfde id naar status pending en via bestaande route naar Informer", async () => {
    const { result } = renderHook(() => useInternalDeclarationMutations(2026), { wrapper: wrap });
    const r = await result.current.edit.mutateAsync({ id: "d1", expectedStatus: "concept", fields, existingReceipts: [], submit: true });
    expect(calls.find((c) => c[0] === "update")![1].status).toBe("pending");
    expect(invoke).toHaveBeenCalledWith("informer-sync?action=declaration_to_informer", { body: { declaration_id: "d1", retry: false } });
    expect(r).toMatchObject({ id: "d1", submitted: true });
    await waitFor(() => expect(result.current.edit.isSuccess).toBe(true));
  });
});
