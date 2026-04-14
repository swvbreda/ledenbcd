import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // Parse available line items sent from the client
    const lineItemsJson = formData.get("line_items") as string | null;
    let lineItemsContext = "";
    if (lineItemsJson) {
      try {
        const lineItems = JSON.parse(lineItemsJson) as Array<{ id: string; label: string }>;
        lineItemsContext = `\n\nBeschikbare begrotingsposten (id → label):\n${lineItems.map(li => `- ${li.id}: ${li.label}`).join("\n")}\n\nKoppel elke regel aan de best passende begrotingspost door het id in matched_line_item_id te zetten. Gebruik deze mappingregels:
- "Vergaderkosten" → zoek post met "Vergaderkosten"
- "Juridische kosten / bestuurlijk advies" → zoek post met "Juridische kosten"
- "Representatiekosten", "Lobby", "Horeca", "Kosten" (onder categorie Representatiekosten) → zoek post met "Representatiekosten"
- "Communicatie / marketing" → zoek post met "Communicatie"
- "Reiskosten" → zoek post met "Reiskosten"
- "ICT / Hosting / Domein / Mail" → zoek post met "ICT"
- "Lidmaatschap", "Contributies" → zoek post met "Contributies"
- "Bankkosten" → zoek post met "Bankkosten"
- "Voorzitter" → zoek post met "Voorzitter"
- "Onderzoek" → zoek post met "Onderzoek"
- "Stg, Maatschappij en cannabis" of "Donatie" → zoek post met "Donatie Stg. Maatschappij"
- "Secretariaatskosten" → zoek post met "Secretariaatskosten"
- "Onkosten vergoedingen" → zoek post met "Onkosten"
Als je geen match vindt, laat matched_line_item_id leeg.`;
      } catch { /* ignore parse errors */ }
    }

    // Convert PDF to base64 using btoa for correct padding
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const CHUNK = 8192;
    let binary = "";
    for (let i = 0; i < bytes.length; i += CHUNK) {
      const slice = bytes.subarray(i, Math.min(i + CHUNK, bytes.length));
      for (let j = 0; j < slice.length; j++) {
        binary += String.fromCharCode(slice[j]);
      }
    }
    const base64 = btoa(binary);

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
- matched_line_item_id: het id van de best passende begrotingspost (indien beschikbaar)

Als er subtotalen of totaalregels zijn, sla die over. Neem alleen individuele transactieregels op.${lineItemsContext}`;

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
                        matched_line_item_id: { type: "string", description: "ID of the matched budget line item" },
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
