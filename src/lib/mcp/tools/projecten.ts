import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { BRON, page, peildatum, requireAdmin, sanitizeSearch } from "../access";

const READ = { readOnlyHint: true, idempotentHint: true, openWorldHint: false } as const;
// No budgets, documents, dossiers, messages, import refs or audit columns.
const PROJECT_COLS = "id, title, status, status_date, description, planning, planning_date, due_date, archived_at, updated_at";
const TASK_COLS = "id, project_id, title, status, priority, deadline, completed_at, updated_at";

export const zoekProjecten = defineTool({
  name: "zoek_projecten",
  title: "Interne projecten zoeken",
  description: "Zoek interne projecten op titel en status (alleen beheerders), met paginering.",
  inputSchema: {
    zoekterm: z.string().max(80).optional(),
    status: z.enum(["actief", "gepauzeerd", "afgerond", "te_bevestigen"]).optional(),
    inclusief_gearchiveerd: z.boolean().default(false),
    limit: z.number().int().min(1).max(50).default(20),
    offset: z.number().int().min(0).max(2000).default(0),
  },
  annotations: READ,
  handler: async (input, ctx) => {
    const client = supabaseForUser(ctx);
    await requireAdmin(ctx, client);
    let q = client.from("internal_projects").select(PROJECT_COLS, { count: "exact" }).order("updated_at", { ascending: false });
    if (input.status) q = q.eq("status", input.status);
    if (!input.inclusief_gearchiveerd) q = q.is("archived_at", null);
    const term = input.zoekterm ? sanitizeSearch(input.zoekterm) : "";
    if (term) q = q.ilike("title", `%${term}%`);
    const { from, to } = page(input.limit, input.offset);
    const { data, error, count } = await q.range(from, to);
    if (error) throw new Error("Projecten konden niet worden opgehaald.");
    const result = { projecten: data ?? [], totaal: count ?? null, bron: BRON, peildatum: peildatum() };
    return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
  },
});

export const zoekTaken = defineTool({
  name: "zoek_taken",
  title: "Interne taken zoeken",
  description: "Zoek interne taken, optioneel per project of status (alleen beheerders), met paginering.",
  inputSchema: {
    project_id: z.string().uuid().optional(),
    status: z.string().max(30).optional(),
    zoekterm: z.string().max(80).optional(),
    limit: z.number().int().min(1).max(50).default(20),
    offset: z.number().int().min(0).max(5000).default(0),
  },
  annotations: READ,
  handler: async (input, ctx) => {
    const client = supabaseForUser(ctx);
    await requireAdmin(ctx, client);
    let q = client.from("internal_tasks").select(TASK_COLS, { count: "exact" }).order("updated_at", { ascending: false });
    if (input.project_id) q = q.eq("project_id", input.project_id);
    if (input.status) q = q.eq("status", input.status);
    const term = input.zoekterm ? sanitizeSearch(input.zoekterm) : "";
    if (term) q = q.ilike("title", `%${term}%`);
    const { from, to } = page(input.limit, input.offset);
    const { data, error, count } = await q.range(from, to);
    if (error) throw new Error("Taken konden niet worden opgehaald.");
    const result = { taken: data ?? [], totaal: count ?? null, bron: BRON, peildatum: peildatum() };
    return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
  },
});
