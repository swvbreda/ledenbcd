import { describe, expect, it } from "vitest";
import { handleRpcAuthError } from "./invokeFunction";

describe("handleRpcAuthError", () => {
  it("logs a user out only for an explicitly invalid or expired session", () => {
    expect(handleRpcAuthError({ message: "JWT expired" })).toBe(true);
    expect(handleRpcAuthError({ message: "Invalid token" })).toBe(true);
  });

  it("does not log a valid user out for an authorization failure", () => {
    expect(handleRpcAuthError({ code: "42501", message: "permission denied for function ensure_member_link" })).toBe(false);
  });
});
