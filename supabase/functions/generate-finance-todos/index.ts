import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify caller is admin
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await anonClient.auth.getUser();
    if (!user) throw new Error("Not authenticated");
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) throw new Error("Not authorized");

    const { year } = await req.json();
    const currentYear = year || new Date().getFullYear();

    // Gather context data
    const [membersRes, contribsRes, invoicesRes, declsRes, existingTodosRes] = await Promise.all([
      supabase.from("members_data").select("id, data, member_type").eq("member_type", "member"),
      supabase.from("member_contributions").select("*").eq("year", currentYear),
      supabase.from("contribution_invoices").select("*").eq("year", currentYear),
      supabase.from("internal_declarations").select("*").eq("year", currentYear),
      supabase.from("finance_todos").select("*").eq("year", currentYear).eq("status", "pending"),
    ]);

    const members = membersRes.data ?? [];
    const contribs = contribsRes.data ?? [];
    const invoices = invoicesRes.data ?? [];
    const decls = declsRes.data ?? [];
    const existingTodos = existingTodosRes.data ?? [];

    const newTodos: Array<{
      todo_type: string;
      title: string;
      description: string;
      assigned_to: string;
      member_id?: number;
      reference_id?: string;
      year: number;
      due_date?: string;
    }> = [];

    // Find existing todo member_ids per type to avoid duplicates
    const existingByType = new Map<string, Set<number>>();
    for (const t of existingTodos) {
      if (!existingByType.has(t.todo_type)) existingByType.set(t.todo_type, new Set());
      if (t.member_id) existingByType.get(t.todo_type)!.add(t.member_id);
    }

    const invoiceMemberIds = new Set(invoices.map((i: any) => i.member_id));
    const contribMap = new Map(contribs.map((c: any) => [c.member_id, c]));

    // 1. Members without invoice
    const newMemberSet = existingByType.get("new_member_invoice") ?? new Set();
    for (const m of members) {
      if (!invoiceMemberIds.has(m.id) && !newMemberSet.has(m.id)) {
        const naam = m.data?.naam ?? `Lid #${m.id}`;
        newTodos.push({
          todo_type: "new_member_invoice",
          title: `Factuur aanmaken voor ${naam}`,
          description: `Lid #${m.id} (${naam}) heeft nog geen contributiefactuur voor ${currentYear}. Het secretariaat moet een factuur aanmaken en versturen.`,
          assigned_to: "secretariaat",
          member_id: m.id,
          year: currentYear,
        });
      }
    }

    // 2. Overdue invoices (invoiced but not paid, invoice_date > 30 days ago)
    const overdueSet = existingByType.get("overdue_invoice") ?? new Set();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    for (const c of contribs) {
      if (!c.paid && c.invoice_date && !overdueSet.has(c.member_id)) {
        const invoiceDate = new Date(c.invoice_date);
        if (invoiceDate < thirtyDaysAgo) {
          const member = members.find((m: any) => m.id === c.member_id);
          const naam = member?.data?.naam ?? `Lid #${c.member_id}`;
          newTodos.push({
            todo_type: "overdue_invoice",
            title: `Herinnering sturen aan ${naam}`,
            description: `De contributiefactuur van ${naam} (lid #${c.member_id}) staat open sinds ${c.invoice_date}. Er moet een betalingsherinnering worden verstuurd.`,
            assigned_to: "penningmeester",
            member_id: c.member_id,
            reference_id: c.id,
            year: currentYear,
          });
        }
      }
    }

    // 3. Pending declarations
    const pendingDeclSet = existingByType.get("pending_declaration") ?? new Set();
    const existingDeclRefs = new Set(
      existingTodos.filter((t: any) => t.todo_type === "pending_declaration").map((t: any) => t.reference_id)
    );
    for (const d of decls) {
      if (d.status === "pending" && !existingDeclRefs.has(d.id)) {
        newTodos.push({
          todo_type: "pending_declaration",
          title: `Declaratie goedkeuren van ${d.board_member_name}`,
          description: `${d.board_member_name} heeft een ${d.declaration_type}-declaratie ingediend van €${d.amount}${d.appointment ? ` voor ${d.appointment}` : ""}. De penningmeester moet deze goedkeuren of afwijzen.`,
          assigned_to: "penningmeester",
          reference_id: d.id,
          year: currentYear,
        });
      }
    }

    // Insert new todos
    if (newTodos.length > 0) {
      const { error } = await supabase.from("finance_todos").insert(newTodos);
      if (error) throw error;
    }

    // Now use AI to generate a summary/advice
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    let aiSummary = "";

    if (LOVABLE_API_KEY) {
      // Re-fetch all pending todos
      const { data: allTodos } = await supabase
        .from("finance_todos")
        .select("*")
        .eq("year", currentYear)
        .eq("status", "pending")
        .order("created_at");

      const todoSummary = (allTodos ?? []).map((t: any) =>
        `- [${t.todo_type}] ${t.title} (toegewezen aan: ${t.assigned_to})`
      ).join("\n");

      const prompt = `Je bent de financieel adviseur van een branchevereniging (BCD). Hieronder staan de openstaande financiële taken voor ${currentYear}:

${todoSummary || "Geen openstaande taken."}

Aanvullende context:
- ${members.length} actieve leden
- ${invoices.length} facturen verstuurd
- ${contribs.filter((c: any) => c.paid).length} van ${contribs.length} contributies betaald
- ${decls.filter((d: any) => d.status === "pending").length} declaraties wachten op goedkeuring

Geef een kort overzicht (max 3-4 zinnen) van de belangrijkste prioriteiten en eventuele aanbevelingen. Schrijf in het Nederlands. Wees concreet en noem namen/aantallen.`;

      try {
        const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              { role: "system", content: "Je bent een financieel assistent voor een Nederlandse branchevereniging. Geef beknopt en praktisch advies." },
              { role: "user", content: prompt },
            ],
          }),
        });

        if (aiResp.ok) {
          const aiData = await aiResp.json();
          aiSummary = aiData.choices?.[0]?.message?.content ?? "";
        }
      } catch (e) {
        console.error("AI summary failed:", e);
      }
    }

    return new Response(
      JSON.stringify({ created: newTodos.length, aiSummary }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-finance-todos error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
