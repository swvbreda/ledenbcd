import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  registerAllowedMember,
  SignupFailure,
  type SignupDependencies,
} from "./signup.ts";

function dependencies(overrides: Partial<SignupDependencies> = {}) {
  const calls: string[] = [];
  const deps: SignupDependencies = {
    findAllowedMember: async () => ({ memberId: 100 }),
    createUser: async () => ({ id: "new-user" }),
    linkProfile: async (_userId, memberId) => { calls.push(`profile:${memberId}`); },
    assignMemberRole: async () => { calls.push("role:user"); },
    unlinkProfile: async () => { calls.push("unlink-profile"); },
    deleteUser: async () => { calls.push("delete-user"); },
    log: (event) => { calls.push(`log:${event}`); },
    reference: () => "REG-TEST01",
    ...overrides,
  };
  return { deps, calls };
}

Deno.test("extra allowed contact is normalized and linked only to its allowed member", async () => {
  let lookedUp = "";
  let createdEmail = "";
  const { deps, calls } = dependencies({
    findAllowedMember: async (email) => { lookedUp = email; return { memberId: 100 }; },
    createUser: async ({ email }) => { createdEmail = email; return { id: "new-user" }; },
  });
  const result = await registerAllowedMember(
    { email: "  EXTRA.Contact@Example.NL ", password: "safe-long-password" },
    deps,
  );
  assertEquals(result, { status: 200, body: { success: true } });
  assertEquals(lookedUp, "extra.contact@example.nl");
  assertEquals(createdEmail, "extra.contact@example.nl");
  assertEquals(calls, ["profile:100", "role:user"]);
});

Deno.test("primary allowed contact follows the same safe path", async () => {
  const { deps, calls } = dependencies();
  const result = await registerAllowedMember(
    { email: "primary@example.nl", password: "safe-long-password" },
    deps,
  );
  assertEquals(result.status, 200);
  assertEquals(calls, ["profile:100", "role:user"]);
});

Deno.test("not allowed email never creates an account", async () => {
  let createCalls = 0;
  const { deps } = dependencies({
    findAllowedMember: async () => null,
    createUser: async () => { createCalls += 1; return { id: "never" }; },
  });
  const result = await registerAllowedMember(
    { email: "unknown@example.nl", password: "safe-long-password" },
    deps,
  );
  assertEquals(result.status, 403);
  assertEquals(createCalls, 0);
});

Deno.test("existing account is not reset, linked or taken over", async () => {
  const { deps, calls } = dependencies({
    createUser: async () => { throw new SignupFailure("existing_account"); },
  });
  const result = await registerAllowedMember(
    { email: "existing@example.nl", password: "safe-long-password" },
    deps,
  );
  assertEquals(result.status, 409);
  assertEquals(calls, ["log:auth_user_create_failed"]);
});

Deno.test("profile failure rolls back the new account and never assigns a role", async () => {
  const { deps, calls } = dependencies({
    linkProfile: async () => { throw new Error("storage failure"); },
  });
  const result = await registerAllowedMember(
    { email: "allowed@example.nl", password: "safe-long-password" },
    deps,
  );
  assertEquals(result.status, 500);
  assertEquals(result.body.reference, "REG-TEST01");
  assertEquals(calls, ["log:member_link_failed", "unlink-profile", "delete-user"]);
});

Deno.test("role failure rolls back profile and account without assigning another role", async () => {
  const setup = dependencies();
  setup.deps.assignMemberRole = async () => {
    setup.calls.push("role:user");
    throw new Error("storage failure");
  };
  const result = await registerAllowedMember(
    { email: "allowed@example.nl", password: "safe-long-password" },
    setup.deps,
  );
  assertEquals(result.status, 500);
  assertEquals(setup.calls, ["profile:100", "role:user", "log:member_link_failed", "unlink-profile", "delete-user"]);
});

Deno.test("concurrent duplicate requests produce one member account and one existing-account response", async () => {
  let created = false;
  const { deps, calls } = dependencies({
    createUser: async () => {
      if (created) throw new SignupFailure("existing_account");
      created = true;
      return { id: "new-user" };
    },
  });
  const input = { email: "repeat@example.nl", password: "safe-long-password" };
  const first = await registerAllowedMember(input, deps);
  const second = await registerAllowedMember(input, deps);
  assertEquals([first.status, second.status], [200, 409]);
  assertEquals(calls.filter((call) => call === "role:user").length, 1);
  assertEquals(calls.filter((call) => call === "profile:100").length, 1);
});