import { describe, it, expect, vi, afterEach } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { loadAccessSnapshot, AccessStepTimeoutError } from "@/lib/accessSnapshot";
import { makeCallerClient } from "@/lib/callerClient";

const URL_ = "https://example.supabase.co";
vi.stubEnv("VITE_SUPABASE_URL", URL_);
vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "pk");

const never = () => new Promise<never>(() => {});
/** Main client exactly like the generated one, but auth lock + broker storage never answer. */
function hangingMainClient() {
  return createClient(URL_, "pk", {
    auth: {
      persistSession: true, autoRefreshToken: false,
      storage: { getItem: never, setItem: never, removeItem: never },
      lock: (() => never()) as any,
    },
  });
}

function stubFetch(calls: string[]) {
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const u = String(input instanceof Request ? input.url : input);
    const h = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    expect(h.get("Authorization")).toBe("Bearer event-token");
    calls.push(new URL(u).pathname);
    const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200, headers: { "content-type": "application/json" } });
    if (u.includes("/auth/v1/user")) return json({ id: "u1", aud: "authenticated", app_metadata: {}, user_metadata: {}, created_at: "" });
    if (u.includes("/user_roles")) return json([{ role: "admin" }]);
    if (u.includes("/rpc/ensure_member_link")) return json(0);
    if (u.includes("/member_profiles")) return json([{ member_id: 7 }]);
    if (u.includes("/board_members")) return json([{ lid_id: 7, lid_ids: [] }]);
    return json([]);
  }));
}

afterEach(() => vi.unstubAllGlobals());

describe("rechtencontrole met hangende hoofd-auth (initialize/getSession/lock)", () => {
  it("elke stap (tokencontrole, rollen, ledenkoppeling, profiel, bestuur) gaat direct uit met de event-token", async () => {
    const calls: string[] = [];
    stubFetch(calls);
    const main = hangingMainClient();
    const refresh = vi.fn(() => main.auth.refreshSession());
    const snap = await loadAccessSnapshot("u1", "event-token", {
      getUser: (t) => main.auth.getUser(t) as any,
      refreshSession: refresh as any,
      makeClient: makeCallerClient as any,
      stepTimeoutMs: 1000,
    });
    expect(snap).toEqual({ roles: ["admin"], memberIds: [7], isBoard: true });
    expect(refresh).not.toHaveBeenCalled();
    for (const p of ["/auth/v1/user", "/rest/v1/user_roles", "/rest/v1/rpc/ensure_member_link", "/rest/v1/member_profiles", "/rest/v1/board_members"])
      expect(calls).toContain(p);
  });

  it("een hangende stap geeft een benoemde fout zonder token", async () => {
    stubFetch([]);
    const p = loadAccessSnapshot("u1", "event-token", {
      getUser: () => never(),
      refreshSession: () => never(),
      makeClient: makeCallerClient as any,
      stepTimeoutMs: 50, // attempts: tokencontrole hangt → bounded
    });
    const err = await p.catch((e) => e);
    expect(err).toBeInstanceOf(AccessStepTimeoutError);
    expect(String(err.message)).not.toContain("event-token");
  });
});
