import { ToolError, type ToolContext } from "@lovable.dev/mcp-js";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Minimal read-only surface of the Supabase client the MCP tools may use. */
export type ReadClient = Pick<SupabaseClient, "from">;

export const BRON = "Ledenbestand BCD (Lovable Cloud database, read-only)";
export const peildatum = () => new Date().toISOString();

/**
 * Server-side admin check. Identity comes only from the verified OAuth token
 * (`sub`); the role is read from user_roles under the caller's own RLS.
 * Board status, member links, metadata or tool input never grant access.
 */
export async function requireAdmin(ctx: Pick<ToolContext, "isAuthenticated" | "getUserId">, client: ReadClient): Promise<string> {
  if (!ctx.isAuthenticated()) throw new ToolError("Niet geauthenticeerd.");
  const userId = ctx.getUserId();
  if (!userId) throw new ToolError("Niet geauthenticeerd.");
  const { data, error } = await client
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .limit(1);
  if (error) throw new ToolError("Rechten konden niet worden gecontroleerd.");
  if (!data || data.length === 0) throw new ToolError("Geen toegang: alleen beheerders mogen deze koppeling gebruiken.");
  return userId;
}

/** Strip characters that carry meaning in PostgREST filter strings / LIKE patterns. */
export function sanitizeSearch(q: string): string {
  return q.replace(/[%_,()*\\:."']/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Whitelisted core profile: business name/address/contact and membership status only. */
export function toMemberProfile(row: { id: number; member_type: string; data: unknown }) {
  const d = (row.data ?? {}) as Record<string, unknown>;
  const locs = Array.isArray(d.locaties) ? (d.locaties as Record<string, unknown>[]) : [];
  return {
    id: row.id,
    lidmaatschapsstatus: row.member_type,
    naam: str(d.naam),
    bedrijfsnaam: str(d.bedrijfsnaam),
    plaats: str(d.plaats),
    kvk: str(d.kvk),
    zakelijk_email: str(d.email),
    zakelijk_telefoon: str(d.telefoon),
    website: str(d.website),
    lid_sinds: typeof d.lidSinds === "number" ? d.lidSinds : null,
    vestigingen: locs.map(toVestiging),
  };
}

export function toVestiging(l: Record<string, unknown>) {
  return {
    naam: str(l.naam),
    adres: str(l.adres),
    postcode: str(l.postcode),
    plaats: str(l.plaats),
    gemeente: str(l.gemeente),
    telefoon: str(l.telefoon),
    website: str(l.website),
  };
}

export function page(limit: number, offset: number) {
  return { from: offset, to: offset + limit - 1 };
}
