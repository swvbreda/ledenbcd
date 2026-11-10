import { describe, it, expect, vi } from "vitest";
import { makeCallerClient } from "@/lib/callerClient";

// The shared Auth client is not involved in a caller-token database request.
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession: () => { throw new Error("Unexpected session storage read"); } } },
}));

describe("caller client with an explicit Auth token", () => {
  it("sends a rights query through the real SDK without creating an Auth client", async () => {
    const fetchSpy = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      expect(headers.get("Authorization")).toBe("Bearer event-token");
      return new Response(JSON.stringify([{ role: "admin" }]), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    const client = makeCallerClient("event-token", fetchSpy as typeof fetch);
    const result = await client.from("user_roles").select("role").eq("user_id", "u1");
    expect(result.error).toBeNull();
    expect(result.data).toEqual([{ role: "admin" }]);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(() => client.auth.getSession()).toThrow();
  });

  it("uses the new token on a fresh caller while the previous client keeps its identity", async () => {
    const tokens: Array<string | null> = [];
    const fetchImpl = async (_url: RequestInfo | URL, init?: RequestInit) => {
      tokens.push(new Headers(init?.headers).get("Authorization"));
      return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
    };
    const original = makeCallerClient("original-token", fetchImpl as typeof fetch);
    const refreshed = makeCallerClient("refreshed-token", fetchImpl as typeof fetch);
    await original.from("user_roles").select("role");
    await refreshed.from("user_roles").select("role");
    await original.from("user_roles").select("role");
    expect(tokens).toEqual(["Bearer original-token", "Bearer refreshed-token", "Bearer original-token"]);
  });
});

