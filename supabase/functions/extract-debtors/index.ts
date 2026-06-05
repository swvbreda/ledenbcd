import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData, error: userErr } = await supa.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: isAdmin } = await supa.rpc("has_role", { _user_id: userData.user.id, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return new Response(JSON.stringify({ error: "No file provided" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const membersJson = formData.get("members") as string | null;
    let membersContext = "";
    if (membersJson) {
      try {
        const members = JSON.parse(membersJson) as Array<{ id: number; naam: string }>;
        membersContext = `\n\nBeschikbare leden (id → naam):\n${members.map(m => `- ${m.id}: ${m.naam}`).join("\n")}\n\nKoppel elke debiteur aan het best passende lid door het id in matched_member_id te zetten. Match op bedrijfsnaam, coffeeshopnaam of persoonsnaam. Als je geen match vindt, laat matched_member_id leeg.`;
      } catch { /* ignore */ }
    }

    // Convert to proper base64 - use btoa for correct padding
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    
    // For large files, chunk the string building but encode as one
    const CHUNK = 8192;
    let binary = "";
    for (let i = 0; i < bytes.length; i += CHUNK) {
      const slice = bytes.subarray(i, Math.min(i + CHUNK, bytes.length));
      for (let j = 0; j < slice.length; j++) {
        binary += String.fromCharCode(slice[j]);
      }
    }
    const base64 = btoa(binary);

    const systemPrompt = `Je bent een financiële data-extractor. Je analyseert debiteurenlijsten uit Visionplanner PDF-exports en extraheert gestructureerde data.

Extraheer ALLE regels uit de debiteurenlijst. Elke regel bevat typisch:
- Debiteur/Klant naam (de naam van het lid, coffeeshop of bedrijf)
- Factuurnummer
- Factuurdatum
- Bedrag (in EUR)
- Eventueel een lidnummer

Geef het resultaat als JSON. Gebruik deze exacte velden:
- debtor_name: naam van de debiteur/klant
- invoice_number: factuurnummer
- invoice_date: factuurdatum in YYYY-MM-DD formaat
- amount: bedrag als getal (positief)
- member_number: lidnummer als dat op de factuur staat (integer)
- matched_member_id: het id van het best passende lid (indien beschikbaar)

Als er subtotalen of totaalregels zijn, sla die over. Neem alleen individuele factuurregels op.${membersContext}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: "Extraheer alle debiteurenregels uit deze Visionplanner PDF. Retourneer alleen de JSON." },
              { type: "image_url", image_url: { url: `data:application/pdf;base64,${base64}` } },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_debtors",
              description: "Return extracted debtor entries from a Visionplanner PDF",
              parameters: {
                type: "object",
                properties: {
                  entries: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        debtor_name: { type: "string", description: "Name of the debtor/member" },
                        invoice_number: { type: "string", description: "Invoice number" },
                        invoice_date: { type: "string", description: "Invoice date in YYYY-MM-DD" },
                        amount: { type: "number", description: "Amount in EUR (positive)" },
                        member_number: { type: "integer", description: "Member number if found" },
                        matched_member_id: { type: "integer", description: "ID of matched member" },
                      },
                      required: ["debtor_name", "amount"],
                    },
                  },
                },
                required: ["entries"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_debtors" } },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Te veel verzoeken, probeer het later opnieuw." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI-tegoed onvoldoende." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI-extractie mislukt" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResult = await response.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({ error: "Kon geen data uit de PDF extraheren" }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = JSON.parse(toolCall.function.arguments);
    const entries = parsed.entries || [];

    return new Response(JSON.stringify({ entries, count: entries.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-debtors error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Onbekende fout" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
