import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { corsHeaders } from "@supabase/supabase-js/cors";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return new Response(JSON.stringify({ error: "No file provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Convert PDF to base64
    const arrayBuffer = await file.arrayBuffer();
    const base64 = base64Encode(new Uint8Array(arrayBuffer));

    const systemPrompt = `Je bent een financiële data-extractor. Je analyseert crediteurenlijsten uit Visionplanner PDF-exports en extraheert gestructureerde data.

Extraheer ALLE regels uit de crediteurenlijst. Elke regel bevat typisch:
- Betaaldatum (payment date)
- Categorie (cost category)
- Onderdeel (sub-category or line item)
- Dossier (project/dossier name)
- Leverancier/Crediteur (creditor/supplier name)
- Factuurnummer (invoice reference number)
- Bedrag (amount in EUR)

Geef het resultaat als JSON array met objecten. Gebruik deze exacte velden:
- expense_date: datum in YYYY-MM-DD formaat
- category: de hoofdcategorie
- line_item: het onderdeel/de begrotingspost
- dossier: het dossier of project (kan leeg zijn)
- creditor_name: naam van de leverancier/crediteur
- invoice_reference: factuurnummer
- amount: bedrag als getal (positief)

Als er subtotalen of totaalregels zijn, sla die over. Neem alleen individuele transactieregels op.`;

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
              {
                type: "text",
                text: "Extraheer alle crediteurenregels uit deze Visionplanner PDF. Retourneer alleen de JSON array, geen andere tekst.",
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:application/pdf;base64,${base64}`,
                },
              },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_creditors",
              description: "Return extracted creditor entries from a Visionplanner PDF",
              parameters: {
                type: "object",
                properties: {
                  entries: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        expense_date: { type: "string", description: "Date in YYYY-MM-DD format" },
                        category: { type: "string", description: "Cost category" },
                        line_item: { type: "string", description: "Budget line item / onderdeel" },
                        dossier: { type: "string", description: "Project or dossier name" },
                        creditor_name: { type: "string", description: "Creditor/supplier name" },
                        invoice_reference: { type: "string", description: "Invoice number" },
                        amount: { type: "number", description: "Amount in EUR (positive)" },
                      },
                      required: ["creditor_name", "amount"],
                    },
                  },
                },
                required: ["entries"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_creditors" } },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Te veel verzoeken, probeer het later opnieuw." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI-tegoed onvoldoende, voeg credits toe." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "AI-extractie mislukt" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResult = await response.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      console.error("Unexpected AI response structure:", JSON.stringify(aiResult));
      return new Response(JSON.stringify({ error: "Kon geen data uit de PDF extraheren" }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = JSON.parse(toolCall.function.arguments);
    const entries = parsed.entries || [];

    return new Response(JSON.stringify({ entries, count: entries.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-creditors error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Onbekende fout" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
