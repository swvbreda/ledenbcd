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
});
