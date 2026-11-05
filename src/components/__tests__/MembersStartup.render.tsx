import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import { MembersDataProvider, useMembersData } from "@/contexts/MembersDataContext";

const state = vi.hoisted(() => ({
  auth: { user: { id: "member-a" } as { id: string } | null, loading: false, isAdmin: false, isBoard: false, isExtern: false, isInhuur: false, linkedMemberIds: [150] },
  own: vi.fn(), directory: vi.fn(), filter: vi.fn(),
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => state.auth }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  from: () => ({ select: () => ({
    neq: (...args: unknown[]) => { state.filter(...args); return { then: (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) => state.own().then(resolve, reject) }; },
    then: (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) => state.own().then(resolve, reject),
  }) }),
  rpc: () => state.directory(),
} }));

const ownRow = { id: 150, member_type: "member", data: { id: 32, naam: "GOA", plaats: "Leiden" } };
const directoryRow = { id: 32, member_type: "member", data: { naam: "Scolo" } };
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={client}><MembersDataProvider>{children}</MembersDataProvider></QueryClientProvider>;
  }
  return renderHook(() => useMembersData(), { wrapper });
}
afterEach(() => { cleanup(); vi.clearAllMocks(); state.auth = { user: { id: "member-a" }, loading: false, isAdmin: false, isBoard: false, isExtern: false, isInhuur: false, linkedMemberIds: [150] }; });

describe("atomic concurrent member startup reads", () => {
  it("starts the directory before the own read finishes and exposes both only after completion", async () => {
    let finishOwn: ((result: unknown) => void) | undefined;
    state.own.mockImplementation(() => new Promise(resolve => { finishOwn = resolve; }));
    state.directory.mockResolvedValue({ data: [directoryRow], error: null });
    const { result } = mount();
    await waitFor(() => expect(state.own).toHaveBeenCalledTimes(1));
    expect(state.directory).toHaveBeenCalledTimes(1);
    expect(result.current.rawMembers).toEqual([]);
    finishOwn?.({ data: [ownRow], error: null });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.rawMembers.map(row => row.id)).toEqual([32, 150]);
    expect(result.current.rawMembers.find(row => row.id === 150)?.naam).toBe("GOA");
    expect(state.filter).toHaveBeenCalledWith("member_type", "lead");
  });
  it("never treats a failed directory as a complete success", async () => {
    state.own.mockResolvedValue({ data: [ownRow], error: null });
    state.directory.mockResolvedValue({ data: null, error: new Error("directory unavailable") });
    const { result } = mount();
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.rawMembers).toEqual([]);
  });
  it("does not fetch either private source without verified authentication", () => {
    state.auth.loading = true;
    mount();
    expect(state.own).not.toHaveBeenCalled();
    expect(state.directory).not.toHaveBeenCalled();
  });
  it("does not fetch the sanitized directory for admins", async () => {
    state.auth.isAdmin = true;
    state.own.mockResolvedValue({ data: [ownRow], error: null });
    const { result } = mount();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(state.directory).not.toHaveBeenCalled();
  });
});