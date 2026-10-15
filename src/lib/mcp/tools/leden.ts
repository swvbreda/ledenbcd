import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { BRON, page, peildatum, requireAdmin, sanitizeSearch, toMemberProfile, type ReadClient } from "../access";

const READ = { readOnlyHint: true, idempotentHint: true, openWorldHint: false } as const;

export async function searchMembers(client: ReadClient, input: { zoekterm?: string; status?: string; limit: number; offset: number }) {
  let q = client.from("members_data").select("id, member_type, data", { count: "exact" }).order("id");
  if (input.status) q = q.eq("member_type", input.status);
  const term = input.zoekterm ? sanitizeSearch(input.zoekterm) : "";
  if (term) q = q.or(`data->>naam.ilike.*${term}*,data->>bedrijfsnaam.ilike.*${term}*,data->>plaats.ilike.*${term}*`);
  const { from, to } = page(input.limit, input.offset);
  const { data, error, count } = await q.range(from, to);
  if (error) throw new Error("Leden konden niet worden opgehaald.");
  return { leden: (data ?? []).map(toMemberProfile), totaal: count ?? null, bron: BRON, peildatum: peildatum() };
}

export const zoekLeden = defineTool({
  name: "zoek_leden",
  title: "Leden zoeken",
  description: "Zoek leden op naam, bedrijfsnaam of plaats; geeft zakelijke kernprofielen met paginering.",
  inputSchema: {
    zoekterm: z.string().max(80).optional().describe("Deel van naam, bedrijfsnaam of plaats."),
    status: z.enum(["member", "lead", "old"]).optional().describe("Lidmaatschapsstatus."),
    limit: z.number().int().min(1).max(50).default(20),
    offset: z.number().int().min(0).max(5000).default(0),
  },
  annotations: READ,
  handler: async (input, ctx) => {
    const client = supabaseForUser(ctx);
    await requireAdmin(ctx, client);
    const result = await searchMembers(client, input);
    return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
  },
});

export const lidProfiel = defineTool({
  name: "lid_profiel",
  title: "Lidprofiel",
  description: "Lees het zakelijke kernprofiel van één lid (naam, zakelijk adres en contact, status, vestigingen).",
  inputSchema: { id: z.number().int().positive() },
  annotations: READ,
  handler: async ({ id }, ctx) => {
    const client = supabaseForUser(ctx);
    await requireAdmin(ctx, client);
    const { data, error } = await client.from("members_data").select("id, member_type, data").eq("id", id).maybeSingle();
    if (error) throw new Error("Lid kon niet worden opgehaald.");
    const result = { lid: data ? toMemberProfile(data) : null, bron: BRON, peildatum: peildatum() };
    return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
  },
});

export const zoekVestigingen = defineTool({
  name: "zoek_vestigingen",
  title: "Coffeeshopvestigingen zoeken",
  description: "Zoek vestigingen van leden op naam, plaats, gemeente of postcode, met paginering.",
  inputSchema: {
    zoekterm: z.string().min(2).max(80),
    limit: z.number().int().min(1).max(50).default(20),
    offset: z.number().int().min(0).max(2000).default(0),
  },
  annotations: READ,
  handler: async ({ zoekterm, limit, offset }, ctx) => {
    const client = supabaseForUser(ctx);
    await requireAdmin(ctx, client);
    const { data, error } = await client.from("members_data").select("id, member_type, data").order("id").range(0, 1999);
    if (error) throw new Error("Vestigingen konden niet worden opgehaald.");
    const term = sanitizeSearch(zoekterm).toLowerCase();
    const hits = (data ?? []).flatMap((row) => {
      const p = toMemberProfile(row);
      return p.vestigingen
        .filter((v) => [v.naam, v.plaats, v.gemeente, v.postcode].some((f) => f?.toLowerCase().includes(term)))
        .map((v) => ({ ...v, lid_id: p.id, lid_naam: p.naam, lidmaatschapsstatus: p.lidmaatschapsstatus }));
    });
    const result = { vestigingen: hits.slice(offset, offset + limit), totaal: hits.length, bron: BRON, peildatum: peildatum() };
    return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
  },
});
