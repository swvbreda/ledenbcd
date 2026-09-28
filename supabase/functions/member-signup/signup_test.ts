import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { classifyAuthFailure, registerAllowedMember, type SignupDependencies } from "./signup.ts";

const PW = "safe-long-password";

function dependencies(overrides: Partial<SignupDependencies> = {}) {
  const calls: string[] = [];
  let n = 0;
  const deps: SignupDependencies = {
    findAllowedMember: async () => ({ memberId: 100 }),
    createUser: async () => ({ id: "new-user" }),
    linkProfile: async (u, m) => { calls.push(`profile:${u}:${m}`); },
    assignMemberRole: async (u) => { calls.push(`role:${u}`); },
    unlinkProfile: async (u) => { calls.push(`unlink:${u}`); },
    deleteUser: async (u) => { calls.push(`delete:${u}`); },
    log: (event, _ref, d) => { calls.push(`log:${event}${d?.kind ? ":" + d.kind : ""}`); },
    reference: () => `REG-T${++n}`,
    ...overrides,
  };
  return { deps, calls };
}

function authError(status: number, code?: string, message = "x") {
  return Object.assign(new Error(message), { status, code });
}

Deno.test("extra allowed contact normalized and linked", async () => {
  let looked = "";
  const { deps, calls } = dependencies({ findAllowedMember: async (e) => { looked = e; return { memberId: 100 }; } });
  const r = await registerAllowedMember({ email: "  EXTRA.Contact@Example.NL ", password: PW }, deps);
  assertEquals(r, { status: 200, body: { success: true } });
  assertEquals(looked, "extra.contact@example.nl");
  assertEquals(calls, ["profile:new-user:100", "role:new-user"]);
});

Deno.test("malformed input => 400 before any auth/db call", async () => {
  for (const raw of [null, [], "x", 5, { email: null, password: PW }, { email: ["a"], password: PW }, { email: "a@b.nl", password: 12345678 }, {}]) {
    let touched = 0;
    const { deps } = dependencies({
      findAllowedMember: async () => { touched++; return { memberId: 1 }; },
      createUser: async () => { touched++; return { id: "x" }; },
    });
    const r = await registerAllowedMember(raw, deps);
    assertEquals(r.status, 400);
    assert(r.body.reference);
    assertEquals(touched, 0);
  }
});

Deno.test("not allowed => 403 without createUser", async () => {
  let created = 0;
  const { deps } = dependencies({ findAllowedMember: async () => null, createUser: async () => { created++; return { id: "n" }; } });
  const r = await registerAllowedMember({ email: "u@example.nl", password: PW }, deps);
  assertEquals(r.status, 403);
  assertEquals(created, 0);
});

Deno.test("classification uses explicit codes only", () => {
  assertEquals(classifyAuthFailure(authError(422, "weak_password")), "weak_password");
  assertEquals(classifyAuthFailure(authError(422, "email_exists")), "existing_account");
  assertEquals(classifyAuthFailure(authError(422, "user_already_exists")), "existing_account");
  assertEquals(classifyAuthFailure(authError(400, "email_address_invalid")), "invalid_email");
  assertEquals(classifyAuthFailure(authError(400, "validation_failed")), "validation_failed");
  assertEquals(classifyAuthFailure(authError(429, "over_request_rate_limit")), "rate_limited");
  assertEquals(classifyAuthFailure(authError(422, undefined, "Something about password hashing")), "unknown");
  assertEquals(classifyAuthFailure(authError(400, "unexpected_failure")), "unknown");
  assertEquals(classifyAuthFailure(authError(422)), "unknown");
});

Deno.test("weak_password vs unknown 422/400 responses", async () => {
  const run = async (err: Error) => {
    const { deps, calls } = dependencies({ createUser: async () => { throw err; } });
    return { r: await registerAllowedMember({ email: "a@b.nl", password: PW }, deps), calls };
  };
  const weak = await run(authError(422, "weak_password"));
  assertEquals(weak.r.status, 422);
  assert(weak.r.body.error!.includes("wachtwoord"));
  assert(weak.r.body.reference);
  for (const err of [authError(422, undefined, "password thing"), authError(400, "something_new")]) {
    const u = await run(err);
    assertEquals(u.r.status, 500);
    assert(!u.r.body.error!.toLowerCase().includes("wachtwoord"));
    assert(u.r.body.error!.includes(u.r.body.reference!));
    assert(u.calls.includes("log:auth_user_create_failed:unknown"));
  }
});

Deno.test("email_exists => 409, no link/compensation; rate limit => 429", async () => {
  const { deps, calls } = dependencies({ createUser: async () => { throw authError(422, "email_exists"); } });
  const r = await registerAllowedMember({ email: "a@b.nl", password: PW }, deps);
  assertEquals(r.status, 409);
  assert(r.body.reference);
  assertEquals(calls, ["log:auth_user_create_failed:existing_account"]);
  const rl = dependencies({ createUser: async () => { throw authError(429, "over_request_rate_limit"); } });
  assertEquals((await registerAllowedMember({ email: "a@b.nl", password: PW }, rl.deps)).status, 429);
});

Deno.test("storage failure compensates only the new user", async () => {
  const { deps, calls } = dependencies({ assignMemberRole: async () => { throw authError(500, "db"); } });
  const r = await registerAllowedMember({ email: "a@b.nl", password: PW }, deps);
  assertEquals(r.status, 500);
  assertEquals(r.body.success, undefined);
  assertEquals(calls, ["profile:new-user:100", "log:member_link_failed", "unlink:new-user", "delete:new-user"]);
});

Deno.test("failed compensation never reports success", async () => {
  const { deps, calls } = dependencies({
    linkProfile: async () => { throw authError(500, "db"); },
    unlinkProfile: async () => { throw authError(500, "db"); },
    deleteUser: async () => { throw authError(500, "auth"); },
  });
  const r = await registerAllowedMember({ email: "a@b.nl", password: PW }, deps);
  assertEquals(r.status, 500);
  assertEquals(r.body.success, undefined);
  assert(calls.includes("log:profile_compensation_failed"));
  assert(calls.includes("log:auth_user_compensation_failed"));
});

Deno.test("truly overlapping calls: one account, loser untouched, existing user never compensated", async () => {
  const existing = new Set<string>();
  const calls: string[] = [];
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  let ids = 0;
  let inFlight = 0, maxInFlight = 0;
  const { deps } = dependencies({
    createUser: async ({ email }) => {
      inFlight++; maxInFlight = Math.max(maxInFlight, inFlight);
      await gate; // both requests are inside createUser at the same time
      inFlight--;
      if (existing.has(email)) throw authError(422, "email_exists");
      existing.add(email);
      return { id: `user-${++ids}` };
    },
    linkProfile: async (u) => { calls.push(`profile:${u}`); },
    assignMemberRole: async (u) => { calls.push(`role:${u}`); },
    unlinkProfile: async (u) => { calls.push(`unlink:${u}`); },
    deleteUser: async (u) => { calls.push(`delete:${u}`); },
  });
  const p = Promise.all([
    registerAllowedMember({ email: "same@b.nl", password: PW }, deps),
    registerAllowedMember({ email: " SAME@b.nl", password: PW }, deps),
  ]);
  await new Promise((r) => setTimeout(r, 0));
  release();
  const results = await p;
  assertEquals(maxInFlight, 2);
  assertEquals(results.map((r) => r.status).sort(), [200, 409]);
  assertEquals(calls, ["profile:user-1", "role:user-1"]);
});
