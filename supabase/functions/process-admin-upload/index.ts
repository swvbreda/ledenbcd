import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
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

    // Parse multipart form data
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const year = parseInt(formData.get("year") as string) || new Date().getFullYear();

    if (!file) throw new Error("No file provided");

    // Re-upload-veilig: wis alleen de nog OPENSTAANDE 'unmatched_payment' todos
    // voor dit jaar, zodat verouderde voorstellen verdwijnen. Afgeronde,
    // genegeerde of on-hold todos blijven staan (historisch besluit blijft),
    // en bestaande koppelingen (paid contributies/uitgaven, dossiers) worden
    // nooit aangeraakt — auto-apply kan paid=false alleen naar true zetten.
    await supabase
      .from("finance_todos")
      .delete()
      .eq("year", year)
      .eq("todo_type", "unmatched_payment")
      .eq("status", "pending");

    // Read file content
    const arrayBuffer = await file.arrayBuffer();
    const fileBytes = new Uint8Array(arrayBuffer);

    // Determine if we can extract text or need to send as base64
    const isTextFile = file.type === "text/csv" || file.name.endsWith(".csv") || file.name.endsWith(".txt");
    let fileContent = "";
    if (isTextFile) {
      fileContent = new TextDecoder().decode(fileBytes);
    }

    // Fetch current administration data for matching
    const [membersRes, contribsRes, invoicesRes, expensesRes] = await Promise.all([
      supabase.from("members_data").select("id, data").eq("member_type", "member"),
      supabase.from("member_contributions").select("*").eq("year", year),
      supabase.from("contribution_invoices").select("*").eq("year", year),
      supabase
        .from("budget_expenses")
        .select("id, creditor_name, amount, paid, paid_date, invoice_reference, description, line_item_id, expense_date")
        .eq("paid", false),
    ]);

    const members = membersRes.data ?? [];
    const contribs = contribsRes.data ?? [];
    const invoices = invoicesRes.data ?? [];
    const expenses = expensesRes.data ?? [];

    // Build context for AI
    const memberList = members.map((m: any) => ({
      id: m.id,
      naam: m.data?.naam,
      bedrijfsnaam: m.data?.bedrijfsnaam,
    }));

    const contribList = contribs.filter((c: any) => !c.paid).map((c: any) => ({
      id: c.id,
      member_id: c.member_id,
      amount: c.amount,
      invoice_number: c.invoice_number,
      invoice_date: c.invoice_date,
    }));

    const expenseList = expenses.map((e: any) => ({
      id: e.id,
      creditor_name: e.creditor_name,
      amount: e.amount,
      invoice_reference: e.invoice_reference,
      description: e.description,
    }));

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("AI not configured");

    const prompt = `Je bent een financieel administratie-assistent voor een branchevereniging (BCD). 
Analyseer het bijgevoegde bestand en extraheer alle betalingen/transacties.

Er zijn TWEE soorten matches mogelijk:

1. LEDENCONTRIBUTIES — match op lidnaam, bedrijfsnaam of factuurnummer:
OPENSTAANDE CONTRIBUTIES (id, member_id, bedrag, factuurnr):
${JSON.stringify(contribList, null, 0)}

LEDEN (id, naam, bedrijfsnaam):
${JSON.stringify(memberList, null, 0)}

2. CREDITEURENBETALINGEN — match op crediteur-naam, bedrag of factuurreferentie:
ONBETAALDE UITGAVEN (id, creditor_name, bedrag, factuurreferentie):
${JSON.stringify(expenseList, null, 0)}

Match elke transactie uit het bestand aan een contributie OF een uitgave. Probeer altijd te matchen op naam en bedrag.

Geef je antwoord UITSLUITEND als JSON array. Elk object heeft:
- "type": "contribution_payment" | "expense_payment" | "unknown"
- "match_id": string (uuid van de gematchte contributie of expense) of null
- "name": string (naam uit het bestand)
- "amount": number (bedrag)
- "date": string (YYYY-MM-DD) of null
- "invoice_number": string of null
- "confidence": "high" | "medium" | "low"
- "description": string (korte uitleg)

Alleen JSON array, geen andere tekst.`;

    // Build the AI request
    const messages: any[] = [
      { role: "system", content: "Je bent een financieel data-extractie specialist. Geef altijd valid JSON terug." },
    ];

    if (isTextFile) {
      messages.push({
        role: "user",
        content: `${prompt}\n\nBESTANDSINHOUD (${file.name}):\n${fileContent}`,
      });
    } else {
      // For PDFs and images, encode as base64 and use vision
      // Chunk the conversion to avoid stack overflow with large files
      let binary = "";
      const chunkSize = 8192;
      for (let i = 0; i < fileBytes.length; i += chunkSize) {
        const chunk = fileBytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode(...chunk);
      }
      const base64 = btoa(binary);
      const mimeType = file.type || "application/pdf";
      messages.push({
        role: "user",
        content: [
          { type: "text", text: prompt },
          {
            type: "image_url",
            image_url: { url: `data:${mimeType};base64,${base64}` },
          },
        ],
      });
    }

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      throw new Error(`AI request failed: ${errText}`);
    }

    const aiData = await aiResp.json();
    let rawContent = aiData.choices?.[0]?.message?.content ?? "[]";
    
    // Clean up potential markdown code fences
    rawContent = rawContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    
    let matches: any[];
    try {
      matches = JSON.parse(rawContent);
    } catch {
      throw new Error("AI gaf geen geldig JSON: " + rawContent.substring(0, 200));
    }

    // Auto-apply high-confidence matches
    const autoApplied: string[] = [];
    const proposals: any[] = [];

    for (const match of matches) {
      if (match.confidence === "high" && match.match_id) {
        const today = match.date || new Date().toISOString().split("T")[0];

        if (match.type === "contribution_payment") {
          const { error } = await supabase
            .from("member_contributions")
            .update({ paid: true, paid_date: today })
            .eq("id", match.match_id)
            .eq("paid", false);
          if (!error) {
            await supabase
              .from("finance_todos")
              .update({ status: "done", completed_at: new Date().toISOString() })
              .eq("reference_id", match.match_id)
              .eq("status", "pending");
            autoApplied.push(match.match_id);
            match.applied = true;
          }
        } else if (match.type === "expense_payment") {
          const { error } = await supabase
            .from("budget_expenses")
            .update({ paid: true, paid_date: today })
            .eq("id", match.match_id)
            .eq("paid", false);
          if (!error) {
            autoApplied.push(match.match_id);
            match.applied = true;
          }
        }
      }
      if (!match.applied) match.applied = false;
      proposals.push(match);
    }

    // Persist unmatched proposals as finance todos so the secretariaat
    // can later koppelen aan een categorie/begrotingspost.
    const unmatched = proposals.filter(
      (p: any) => !p.applied && (!p.match_id || p.type === "unknown")
    );
    let unmatchedTodosCreated = 0;
    if (unmatched.length > 0) {
      // Fetch existing reference_ids voor dit jaar om dubbele todos te voorkomen
      const { data: existing } = await supabase
        .from("finance_todos")
        .select("reference_id")
        .eq("year", year)
        .eq("todo_type", "unmatched_payment");
      const existingRefs = new Set(
        (existing ?? []).map((t: any) => t.reference_id).filter(Boolean)
      );
      const fmtEur = (n: number) =>
        new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(n);
      for (const p of unmatched) {
        const amount = Number(p.amount) || 0;
        const name = (p.name || "Onbekend").toString().slice(0, 80);
        const date = p.date || "";
        // Stabiele ref: datum + bedrag + naam (lower)
        const ref = `unmatched:${date}|${amount.toFixed(2)}|${name.toLowerCase()}`;
        if (existingRefs.has(ref)) continue;
        const { error: insErr } = await supabase.from("finance_todos").insert({
          todo_type: "unmatched_payment",
          title: `Betaling toewijzen: ${name} — ${fmtEur(amount)}`,
          description:
            `Bankafschrift (${file.name}) bevat een betaling die niet automatisch ` +
            `gekoppeld kon worden aan een contributie of crediteur.\n` +
            (date ? `Datum: ${date}\n` : "") +
            `Bedrag: ${fmtEur(amount)}\n` +
            (p.invoice_number ? `Factuurnr: ${p.invoice_number}\n` : "") +
            (p.description ? `AI: ${p.description}` : ""),
          assigned_to: "penningmeester",
          reference_id: ref,
          year,
        });
        if (!insErr) unmatchedTodosCreated++;
      }
    }

    return new Response(
      JSON.stringify({
        proposals,
        autoApplied: autoApplied.length,
        unmatchedTodosCreated,
        total: matches.length,
        fileName: file.name,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("process-admin-upload error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
