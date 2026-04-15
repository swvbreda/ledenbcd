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

    // Parse multipart form data
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const year = parseInt(formData.get("year") as string) || new Date().getFullYear();

    if (!file) throw new Error("No file provided");

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
    const [membersRes, contribsRes, invoicesRes] = await Promise.all([
      supabase.from("members_data").select("id, data").eq("member_type", "member"),
      supabase.from("member_contributions").select("*").eq("year", year),
      supabase.from("contribution_invoices").select("*").eq("year", year),
    ]);

    const members = membersRes.data ?? [];
    const contribs = contribsRes.data ?? [];
    const invoices = invoicesRes.data ?? [];

    // Build context for AI
    const memberList = members.map((m: any) => ({
      id: m.id,
      naam: m.data?.naam,
      bedrijfsnaam: m.data?.bedrijfsnaam,
      coffeeshop: m.data?.coffeeshop,
    }));

    const contribList = contribs.map((c: any) => ({
      id: c.id,
      member_id: c.member_id,
      amount: c.amount,
      paid: c.paid,
      invoice_number: c.invoice_number,
      invoice_date: c.invoice_date,
    }));

    const invoiceList = invoices.map((i: any) => ({
      id: i.id,
      member_id: i.member_id,
      invoice_number: i.invoice_number,
    }));

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("AI not configured");

    const prompt = `Je bent een financieel administratie-assistent voor een branchevereniging (BCD). 
Analyseer het bijgevoegde bestand en extraheer betalingen, facturen of andere financiële transacties.

Match elke transactie aan een lid uit de ledenlijst op basis van naam, bedrijfsnaam, factuurnummer, of bedrag.

LEDENLIJST (id, naam, bedrijfsnaam):
${JSON.stringify(memberList, null, 0)}

CONTRIBUTIE-ADMINISTRATIE (id, member_id, bedrag, betaald, factuurnr, factuurdatum):
${JSON.stringify(contribList, null, 0)}

FACTUREN (id, member_id, factuurnr):
${JSON.stringify(invoiceList, null, 0)}

Geef je antwoord UITSLUITEND als JSON array met objecten. Elk object heeft:
- "type": "payment_received" | "invoice_sent" | "unknown"
- "member_id": number of null als niet gematcht
- "member_name": string (naam uit het bestand)
- "amount": number (bedrag)
- "date": string (datum, YYYY-MM-DD) of null
- "invoice_number": string of null
- "contribution_id": string (uuid van de contributie) of null als niet gematcht
- "confidence": "high" | "medium" | "low"
- "description": string (korte uitleg van de match)

Alleen JSON array teruggeven, geen andere tekst.`;

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
      const base64 = btoa(String.fromCharCode(...fileBytes));
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
      if (match.confidence === "high" && match.contribution_id && match.type === "payment_received") {
        // Auto-apply: mark contribution as paid
        const { error } = await supabase
          .from("member_contributions")
          .update({
            paid: true,
            paid_date: match.date || new Date().toISOString().split("T")[0],
          })
          .eq("id", match.contribution_id)
          .eq("paid", false);

        if (!error) {
          // Complete related todo
          await supabase
            .from("finance_todos")
            .update({ status: "done", completed_at: new Date().toISOString() })
            .eq("reference_id", match.contribution_id)
            .eq("status", "pending");

          autoApplied.push(match.contribution_id);
          match.applied = true;
        }
      } else {
        match.applied = false;
      }
      proposals.push(match);
    }

    return new Response(
      JSON.stringify({
        proposals,
        autoApplied: autoApplied.length,
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
