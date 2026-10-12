import type { EligibilityStore } from "./adviesEligibility";

/** Service-role opslag; alleen server-side. Tabellen hebben geen client-policies. */
export async function serviceEligibilityStore(): Promise<EligibilityStore> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;
  return {
    async rateLimit(kind, subjectHash, max, windowSeconds) {
      const { data, error } = await db.rpc("advies_rate_limit", {
        _kind: kind, _subject_hash: subjectHash, _max: max, _window_seconds: windowSeconds,
      });
      if (error) throw new Error("rate limit unavailable");
      return data === true;
    },
    async isCurrentMember(userId) {
      const { data, error } = await db.rpc("advies_is_current_member", { _user_id: userId });
      if (error) throw new Error("membership check unavailable");
      return data === true;
    },
    async insertCode(row) {
      const { error } = await db.from("advies_eligibility_codes").insert({
        code_hash: row.codeHash, code_challenge: row.challenge, audience: row.audience,
        user_id: row.userId, expires_at: row.expiresAt.toISOString(),
      });
      if (error) throw new Error("code store unavailable");
    },
    async consumeCode(codeHash, audience) {
      const { data, error } = await db.rpc("advies_consume_code", { _code_hash: codeHash, _audience: audience });
      if (error) throw new Error("code store unavailable");
      const r = Array.isArray(data) ? data[0] : null;
      return r ? { userId: r.user_id, challenge: r.code_challenge } : null;
    },
  };
}
