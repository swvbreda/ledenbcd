import { describe, it, expect, vi } from "vitest";
import { makeCallerClient } from "@/lib/callerClient";

describe("caller client bij hangende sessie-opslag", () => {
  it("verstuurt rechtentabel-query direct met de Auth-event-token, zonder getSession/lock", async () => {
    // Hangende broker: elke poging om opslag/sessie te lezen blijft eeuwig open.
    const never = new Promise<never>(() => {});
    const getSessionSpy = vi.fn(() => never);
    const fetchSpy = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      const h = new Headers(init?.headers);
      expect(h.get("Authorization")).toBe("Bearer event-token");
      return new Response(JSON.stringify([{ role: "admin" }]), { status: 200, headers: { "content-type": "application/json" } });
    });
    const client = makeCallerClient("event-token", fetchSpy as unknown as typeof fetch);
    const res = await Promise.race([
      client.from("user_roles").select("role").eq("user_id", "u1"),
      new Promise((_, rej) => setTimeout(() => rej(new Error("hangt")), 1000)),
    ]) as { data: unknown };
    expect(res.data).toEqual([{ role: "admin" }]);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(getSessionSpy).not.toHaveBeenCalled();
    // Geen eigen GoTrue-instantie: sessie-API bestaat niet op deze client.
    expect(() => (client.auth as any).getSession()).toThrow();
  });
});
