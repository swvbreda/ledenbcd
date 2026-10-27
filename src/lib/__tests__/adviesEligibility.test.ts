import { describe, it, expect } from "vitest";
import {
  issueEligibilityCode, redeemEligibilityCode, s256Challenge, isAllowedAudience,
  type EligibilityStore, CODE_TTL_SECONDS, ISSUE_LIMIT, REDEEM_LIMIT,
} from "../adviesEligibility";

const AUD = "https://bureau-preview.example.app";
const allowed = [AUD];
const VERIFIER = "a".repeat(20) + "B-._~" + "c".repeat(30);

function memStore(members: Set<string>) {
  const rows = new Map<string, { challenge: string; audience: string; userId: string; expiresAt: Date; consumed: boolean }>();
  const hits = new Map<string, number>();
  let now = new Date("2026-10-12T19:00:00Z");
  const store: EligibilityStore = {
    async rateLimit(kind, s, max) { const k = kind + s; const n = hits.get(k) ?? 0; if (n >= max) return false; hits.set(k, n + 1); return true; },
    async isCurrentMember(u) { return members.has(u); },
    async insertCode(r) { rows.set(r.codeHash, { ...r, consumed: false }); },
    async consumeCode(h, a) {
      const r = rows.get(h);
      if (!r || r.consumed || r.audience !== a || r.expiresAt <= now) return null;
      r.consumed = true; return { userId: r.userId, challenge: r.challenge };
    },
  };
  return { store, rows, advance: (s: number) => { now = new Date(now.getTime() + s * 1000); }, now: () => now };
}

async function issued(m: ReturnType<typeof memStore>, userId = "u1") {
  const r = await issueEligibilityCode(m.store, { userId, challenge: await s256Challenge(VERIFIER), method: "S256", audience: AUD }, { allowed, now: m.now() });
  if (!r.ok) throw new Error(r.reason);
  return r.code;
}
const redeem = (m: ReturnType<typeof memStore>, code: string, verifier = VERIFIER, audience = AUD, clientKey = "ip1") =>
  redeemEligibilityCode(m.store, { code, verifier, audience, clientKey }, { allowed });

describe("adviespakket eligibility", () => {
  it("member: code redeems once to eligible true, only boolean returned", async () => {
    const m = memStore(new Set(["u1"]));
    const code = await issued(m);
    const r = await redeem(m, code);
    expect(r.body).toEqual({ eligible: true });
    expect(Object.keys(r.body)).toEqual(["eligible"]);
  });

  it("stores only a hash, never the code", async () => {
    const m = memStore(new Set(["u1"]));
    const code = await issued(m);
    expect([...m.rows.keys()][0]).toMatch(/^[0-9a-f]{64}$/);
    expect(m.rows.has(code)).toBe(false);
  });

  it("non-member gets no code", async () => {
    const m = memStore(new Set());
    const r = await issueEligibilityCode(m.store, { userId: "u1", challenge: await s256Challenge(VERIFIER), method: "S256", audience: AUD }, { allowed });
    expect(r).toEqual({ ok: false, reason: "not_eligible" });
  });

  it("replay is rejected", async () => {
    const m = memStore(new Set(["u1"]));
    const code = await issued(m);
    await redeem(m, code);
    expect((await redeem(m, code)).body.eligible).toBe(false);
  });

  it("expired after 60s", async () => {
    const m = memStore(new Set(["u1"]));
    const code = await issued(m);
    m.advance(CODE_TTL_SECONDS);
    expect((await redeem(m, code)).body.eligible).toBe(false);
  });

  it("wrong PKCE verifier fails and burns the code", async () => {
    const m = memStore(new Set(["u1"]));
    const code = await issued(m);
    expect((await redeem(m, code, "z".repeat(43))).body.eligible).toBe(false);
    expect((await redeem(m, code)).body.eligible).toBe(false);
  });

  it("membership is rechecked at redeem", async () => {
    const members = new Set(["u1"]);
    const m = memStore(members);
    const code = await issued(m);
    members.delete("u1");
    expect((await redeem(m, code)).body.eligible).toBe(false);
  });

  it("outsider audiences and tampering are rejected", async () => {
    expect(isAllowedAudience(AUD + "/", allowed)).toBe(false);
    expect(isAllowedAudience(AUD + ".evil.com", allowed)).toBe(false);
    expect(isAllowedAudience("http://bureau-preview.example.app", ["http://bureau-preview.example.app"])).toBe(false);
    expect(isAllowedAudience(AUD, [])).toBe(false);
    const m = memStore(new Set(["u1"]));
    const code = await issued(m);
    expect((await redeem(m, code, VERIFIER, "https://evil.example")).status).toBe(400);
    expect((await redeem(m, code.slice(0, -1) + (code.endsWith("A") ? "B" : "A"))).body.eligible).toBe(false);
    const plain = await issueEligibilityCode(m.store, { userId: "u1", challenge: await s256Challenge(VERIFIER), method: "plain", audience: AUD }, { allowed });
    expect(plain).toEqual({ ok: false, reason: "invalid_request" });
  });

  it("rate limits issuing and redeeming", async () => {
    const m = memStore(new Set(["u1"]));
    for (let i = 0; i < ISSUE_LIMIT.max; i++) await issued(m);
    const r = await issueEligibilityCode(m.store, { userId: "u1", challenge: await s256Challenge(VERIFIER), method: "S256", audience: AUD }, { allowed });
    expect(r).toEqual({ ok: false, reason: "rate_limited" });
    const m2 = memStore(new Set());
    for (let i = 0; i < REDEEM_LIMIT.max; i++) await redeem(m2, "x".repeat(43), VERIFIER, AUD, "ipX");
    expect((await redeem(m2, "x".repeat(43), VERIFIER, AUD, "ipX")).status).toBe(429);
  });
});

describe("adviespakket audiences", () => {
  it("allows exact published bureau origin and preview, nothing else", () => {
    expect(isAllowedAudience("https://www.hetstrategiebureau.com")).toBe(true);
    expect(isAllowedAudience("https://id-preview--04ac87a1-0bf3-400e-8a36-4edd55cd358c.lovable.app")).toBe(true);
    for (const o of ["https://hetstrategiebureau.com", "https://www.hetstrategiebureau.com/", "https://www.hetstrategiebureau.com/portaal", "http://www.hetstrategiebureau.com", "https://evil.www.hetstrategiebureau.com", "https://www.hetstrategiebureau.com.evil.app"])
      expect(isAllowedAudience(o)).toBe(false);
  });
});
