import { describe, expect, it, vi } from "vitest";
import { fetchRolesWithSessionRecovery } from "./authAccess";

describe("fetchRolesWithSessionRecovery", () => {
  it("gebruikt de rollen zodra de sessie geldig is", async () => {
    const refreshSession = vi.fn(async () => undefined);

    const roles = await fetchRolesWithSessionRecovery({
      expectedUserId: "user-1",
      getAuthenticatedUserId: async () => "user-1",
      fetchRoles: async () => ["admin"],
      refreshSession,
      retryDelayMs: 0,
    });

    expect(roles).toEqual(["admin"]);
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it("ververst een nog niet herstelde native sessie en probeert opnieuw", async () => {
    const getAuthenticatedUserId = vi
      .fn<() => Promise<string | null>>()
      .mockRejectedValueOnce(new Error("Auth session missing"))
      .mockResolvedValue("user-1");
    const refreshSession = vi.fn(async () => undefined);

    const roles = await fetchRolesWithSessionRecovery({
      expectedUserId: "user-1",
      getAuthenticatedUserId,
      fetchRoles: async () => ["admin"],
      refreshSession,
      retryDelayMs: 0,
    });

    expect(roles).toEqual(["admin"]);
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(getAuthenticatedUserId).toHaveBeenCalledTimes(2);
  });

  it("accepteert een geldige gebruiker zonder bijzondere rol", async () => {
    const roles = await fetchRolesWithSessionRecovery({
      expectedUserId: "user-1",
      getAuthenticatedUserId: async () => "user-1",
      fetchRoles: async () => [],
      refreshSession: async () => undefined,
      retryDelayMs: 0,
    });

    expect(roles).toEqual([]);
  });

  it("vernieuwt de sessie niet bij een 504 van de inlogservice, maar probeert wel opnieuw", async () => {
    const err504 = Object.assign(new Error("context deadline exceeded"), { status: 504 });
    const getAuthenticatedUserId = vi
      .fn<() => Promise<string | null>>()
      .mockRejectedValueOnce(err504)
      .mockResolvedValue("user-1");
    const refreshSession = vi.fn(async () => undefined);
    const roles = await fetchRolesWithSessionRecovery({
      expectedUserId: "user-1",
      getAuthenticatedUserId,
      fetchRoles: async () => ["admin"],
      refreshSession,
      retryDelayMs: 0,
    });
    expect(roles).toEqual(["admin"]);
    expect(refreshSession).not.toHaveBeenCalled();
    expect(getAuthenticatedUserId).toHaveBeenCalledTimes(2);
  });

  it("aanhoudende backendfout geeft fout zonder sessievernieuwing of rechten", async () => {
    const refreshSession = vi.fn(async () => undefined);
    const fetchRoles = vi.fn(async () => ["admin"]);
    await expect(
      fetchRolesWithSessionRecovery({
        expectedUserId: "user-1",
        getAuthenticatedUserId: async () => {
          throw Object.assign(new Error("Failed to fetch"), { name: "AuthRetryableFetchError", status: 0 });
        },
        fetchRoles,
        refreshSession,
        retryDelayMs: 0,
      }),
    ).rejects.toThrow(/Failed to fetch/);
    expect(refreshSession).not.toHaveBeenCalled();
    expect(fetchRoles).not.toHaveBeenCalled();
  });

  it("andere gebruiker in sessie blijft wel een vernieuwing waard en geeft geen rechten", async () => {
    const refreshSession = vi.fn(async () => undefined);
    await expect(
      fetchRolesWithSessionRecovery({
        expectedUserId: "user-1",
        getAuthenticatedUserId: async () => "user-2",
        fetchRoles: async () => ["admin"],
        refreshSession,
        retryDelayMs: 0,
      }),
    ).rejects.toThrow();
    expect(refreshSession).toHaveBeenCalledTimes(2);
  });
});
