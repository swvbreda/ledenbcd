import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

// Geïsoleerd: nagebootste auth-client en Capacitor, geen backend, geen echte sessies of tokens.
const m = vi.hoisted(() => ({
  authCb: null as null | ((event: string, session: any) => void),
  getSession: vi.fn(),
  refreshSession: vi.fn(),
  signOut: vi.fn(),
  getUser: vi.fn(),
  rpc: vi.fn(),
  roles: [] as Array<{ role: string }>,
  profiles: [] as Array<{ member_id: number }>,
  appEvents: new Map<string, (v: any) => void>(),
  calls: [] as string[],
}));

vi.mock("@/integrations/supabase/client", () => {
  const rows = (t: string) => (t === "user_roles" ? m.roles : t === "member_profiles" ? m.profiles : []);
  return {
    supabase: {
      auth: {
        onAuthStateChange: (cb: any) => {
          m.authCb = cb;
          return { data: { subscription: { unsubscribe: vi.fn() } } };
        },
        getSession: m.getSession,
        refreshSession: m.refreshSession,
        signOut: m.signOut,
        getUser: m.getUser,
      },
      rpc: m.rpc,
      from: (t: string) => ({
        select: () => {
          m.calls.push(`select:${t}`);
          const result = Promise.resolve({ data: rows(t), error: null });
          return { eq: () => result, then: (f: any, r: any) => result.then(f, r) };
        },
      }),
    },
  };
});
vi.mock("@/lib/memberAccessFlag", () => ({ memberPasswordlessEnabled: false }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: () => true } }));
vi.mock("@capacitor/app", () => ({
  App: {
    addListener: async (name: string, fn: (v: any) => void) => {
      m.appEvents.set(name, fn);
      return { remove: vi.fn().mockResolvedValue(undefined) };
    },
  },
}));

import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { RECONNECTING_MESSAGE } from "@/lib/sessionRestore";
import { SESSION_EXPIRED_EVENT_NAME } from "@/lib/invokeFunction";

const USER = { id: "fixture-user", user_metadata: {} };
const SESSION = { user: USER, access_token: "synthetic", refresh_token: "synthetic", expires_at: 0 };
const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;
const transient = () => Object.assign(new Error("Load failed"), { name: "AuthRetryableFetchError", status: 0 });
const definitive = () =>
  Object.assign(new Error("Invalid Refresh Token: Refresh Token Not Found"), {
    name: "AuthApiError", status: 400, code: "refresh_token_not_found",
  });

let assign: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.clearAllMocks();
  m.authCb = null; m.appEvents.clear(); m.calls = [];
  m.roles = [{ role: "admin" }]; m.profiles = [{ member_id: 7 }];
  m.getUser.mockResolvedValue({ data: { user: USER }, error: null });
  m.rpc.mockResolvedValue({ data: 0, error: null });
  m.signOut.mockResolvedValue({ error: null });
  localStorage.clear();
  assign = vi.fn();
  Object.defineProperty(window, "location", { configurable: true, value: { ...window.location, pathname: "/", assign } });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("sessie blijft bewaard op de telefoon", () => {
  it("koude start met bewaarde sessie: ingelogd met server-geverifieerde rechten, geen geforceerde vernieuwing", async () => {
    m.getSession.mockResolvedValue({ data: { session: SESSION }, error: null });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user?.id).toBe("fixture-user");
    expect(result.current.isAdmin).toBe(true);
    expect(result.current.linkedMemberIds).toEqual([7]);
    expect(result.current.authError).toBeNull();
    expect(m.refreshSession).not.toHaveBeenCalled();
  });

  it("tijdelijke netwerkfout bij koude start (verlopen toegangstoken) toont geen loginscherm en geeft geen rechten", async () => {
    m.getSession.mockResolvedValue({ data: { session: null }, error: transient() });
    const { result } = renderHook(() => useAuth(), { wrapper });
    // supabase-js meldt INITIAL_SESSION null terwijl de sessie bewaard blijft (issue #2748)
    act(() => m.authCb?.("INITIAL_SESSION", null));
    await waitFor(() => expect(result.current.authError).toBe(RECONNECTING_MESSAGE));
    expect(result.current.user).toBeNull();
    expect(result.current.isAdmin).toBe(false);
    expect(m.signOut).not.toHaveBeenCalled();

    // De eigen vernieuwing van supabase-js slaagt later: zelfde gebruiker terug, rechten opnieuw uit de database.
    act(() => m.authCb?.("TOKEN_REFRESHED", SESSION));
    await waitFor(() => expect(result.current.isAdmin).toBe(true));
    expect(result.current.authError).toBeNull();
    expect(result.current.user?.id).toBe("fixture-user");
  });

  it("time-out van de inlogservice is ook tijdelijk, niet uitgelogd", async () => {
    m.getSession.mockRejectedValue(Object.assign(new Error("De inlogservice reageerde niet binnen 15 seconden"), { name: "AuthTimeoutError" }));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.authError).toBe(RECONNECTING_MESSAGE));
    expect(result.current.user).toBeNull();
  });

  it("echt ongeldige/ingetrokken sessie gaat naar inloggen zonder foutscherm of rechten", async () => {
    m.getSession.mockResolvedValue({ data: { session: null }, error: definitive() });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();
    expect(result.current.authError).toBeNull();
    expect(result.current.isAdmin).toBe(false);
  });

  it("SIGNED_OUT van de auth-client blijft leidend en wist rechten", async () => {
    m.getSession.mockResolvedValue({ data: { session: SESSION }, error: null });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isAdmin).toBe(true));
    act(() => m.authCb?.("SIGNED_OUT", null));
    await waitFor(() => expect(result.current.user).toBeNull());
    expect(result.current.isAdmin).toBe(false);
  });

  it("terugkeer in de app vernieuwt alleen indien nodig en controleert rechten opnieuw", async () => {
    m.getSession.mockResolvedValue({ data: { session: SESSION }, error: null });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isAdmin).toBe(true));
    await waitFor(() => expect(m.appEvents.has("appStateChange")).toBe(true));
    const before = m.getSession.mock.calls.length;
    const rolesBefore = m.calls.filter((c) => c === "select:user_roles").length;
    m.roles = []; // rechten ingetrokken in de database
    act(() => { m.appEvents.get("appStateChange")?.({ isActive: false }); m.appEvents.get("appStateChange")?.({ isActive: true }); });
    await waitFor(() => expect(result.current.isAdmin).toBe(false));
    expect(m.getSession.mock.calls.length).toBeGreaterThan(before);
    expect(m.calls.filter((c) => c === "select:user_roles").length).toBe(rolesBefore + 1);
    expect(m.refreshSession).not.toHaveBeenCalled();
  });

  it("verlopen-melding met tijdelijke vernieuwingsfout logt niet uit", async () => {
    m.getSession.mockResolvedValue({ data: { session: SESSION }, error: null });
    m.refreshSession.mockResolvedValue({ data: { session: null }, error: transient() });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isAdmin).toBe(true));
    await act(async () => { window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT_NAME)); await new Promise((r) => setTimeout(r, 0)); });
    await waitFor(() => expect(m.refreshSession).toHaveBeenCalledTimes(1));
    expect(m.signOut).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
  });

  it("verlopen-melding met definitieve weigering ruimt lokaal op en stuurt naar inloggen", async () => {
    m.getSession.mockResolvedValue({ data: { session: SESSION }, error: null });
    m.refreshSession.mockResolvedValue({ data: { session: null }, error: definitive() });
    localStorage.setItem("emfa_fixture-user", "1");
    localStorage.setItem("remember_me", "true");
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isAdmin).toBe(true));
    await new Promise((r) => setTimeout(r, 2100)); // dedupe-venster van eerdere melding verlopen
    act(() => { window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT_NAME)); });
    await waitFor(() => expect(m.signOut).toHaveBeenCalledWith({ scope: "local" }));
    expect(localStorage.getItem("emfa_fixture-user")).toBeNull();
    expect(localStorage.getItem("remember_me")).toBe("true"); // keuze 'Onthoud mij' blijft
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/login"));
  });

  it("expliciet uitloggen ruimt op en trekt de sessie overal in", async () => {
    m.getSession.mockResolvedValue({ data: { session: SESSION }, error: null });
    localStorage.setItem("emfa_fixture-user", "1");
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isAdmin).toBe(true));
    await act(async () => { await result.current.signOut(); });
    expect(m.signOut).toHaveBeenCalledWith();
    expect(localStorage.getItem("emfa_fixture-user")).toBeNull();
  });

  it("ledenkoppeling: alleen opnieuw lezen als ensure_member_link iets toevoegde", async () => {
    m.getSession.mockResolvedValue({ data: { session: SESSION }, error: null });
    m.rpc.mockResolvedValue({ data: 1, error: null });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(m.calls.filter((c) => c === "select:member_profiles").length).toBe(2);
    cleanup(); m.calls = []; m.rpc.mockResolvedValue({ data: 0, error: null });
    const second = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(second.result.current.loading).toBe(false));
    expect(m.calls.filter((c) => c === "select:member_profiles").length).toBe(1);
  });
});
