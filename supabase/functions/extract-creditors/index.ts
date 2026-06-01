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

    const systemPrompt = `Je bent een financiële data-extractor. Je analyseert PDF-exports met financiële regels.
Dit kan zijn:
  (a) een crediteurenlijst uit Visionplanner (alleen uitgaven), of
  (b) een bankafschrift / mutatieoverzicht met zowel BIJSCHRIJVINGEN (Bij/credit/+, geld dat binnenkomt) als AFSCHRIJVINGEN (Af/debit/-, geld dat uitgaat).

Extraheer ELKE individuele transactieregel. Sla subtotalen, saldo-, openings- en eindregels over.

SALDO-EXTRACTIE (bankafschriften): zoek expliciet naar het BEGIN- en EINDSALDO (ook wel "Saldo per ...", "Beginsaldo", "Eindsaldo", "Saldo vorig overzicht", "Nieuw saldo"). Geef deze terug in opening_balance en closing_balance als getal in EUR (negatief bij debet/rood). Laat ze leeg (null) als de PDF geen saldo vermeldt.

BELANGRIJK — bepaal voor elke regel de richting van het geld:
- "in"  = bijschrijving / Bij / credit / "+" / geld dat de rekening binnenkomt
- "out" = afschrijving / Af / debit / "-" / geld dat van de rekening gaat
Bij bankafschriften staat dit vaak als kolom "Bij/Af", als plus/min-teken, of als aparte kolommen "Bij" en "Af". Bij Visionplanner crediteurenlijsten is direction altijd "out".
Regels met een contributiefactuurnummer, lidnaam of omschrijving zoals contributie/lidmaatschap zijn meestal inkomsten: markeer deze als direction "in" en zet NOOIT matched_line_item_id.
Een regel mag alleen direction "out" krijgen wanneer het bankafschrift duidelijk toont dat het bedrag is afgeschreven.

Velden per regel:
- expense_date: datum in YYYY-MM-DD formaat
- direction: "in" of "out" (verplicht)
- category: de hoofdcategorie (alleen Visionplanner)
- line_item: het onderdeel/de begrotingspost (alleen Visionplanner)
- dossier: ALLEEN een expliciet dossier- of projectnaam zoals die door de boekhouder is toegekend (bv. "Verkiezingen", "Amsterdam i-criterium", "Samenwerking PCN"). LAAT LEEG bij bankafschriften en in alle andere gevallen waar je het niet zeker weet. Vul NOOIT een plaatsnaam, stadsnaam, kolomheader, leveranciersnaam, betaalprovider (zoals "Worldline", "Buckaroo"), categorie of "Banken" in als dossier.
- creditor_name: naam van de tegenpartij (leverancier bij uitgave, betaler bij inkomst). Bij bankafschriften: de naam van de tegenrekeninghouder, NIET een omschrijving.
- invoice_reference: factuurnummer of betalingskenmerk
- amount: bedrag als POSITIEF getal in EUR (richting staat al in direction)
- matched_line_item_id: alleen invullen voor direction "out", id van de best passende begrotingspost (indien beschikbaar)

De import moet exact overeenkomen met wat er op het bankafschrift staat: laat geen regels weg en verander geen bedragen of richting.${lineItemsContext}`;

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
                         direction: { type: "string", enum: ["in", "out"], description: "in = bijschrijving (credit), out = afschrijving (debit)" },
                         category: { type: "string", description: "Cost category" },
                         line_item: { type: "string", description: "Budget line item / onderdeel" },
                         dossier: { type: "string", description: "Project or dossier name" },
                         creditor_name: { type: "string", description: "Counter-party name (supplier for out, payer for in)" },
                         invoice_reference: { type: "string", description: "Invoice number or payment reference" },
                         amount: { type: "number", description: "Amount in EUR (always positive)" },
                          matched_line_item_id: { type: "string", description: "ID of the matched budget line item. Alleen invullen bij direction=out; bij direction=in altijd leeg laten." },
                       },
                       required: ["creditor_name", "amount", "direction"],
                    },
                  },
                  opening_balance: { type: ["number", "null"], description: "Beginsaldo in EUR (negatief = debet). Null als niet aanwezig." },
                  closing_balance: { type: ["number", "null"], description: "Eindsaldo in EUR (negatief = debet). Null als niet aanwezig." },
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
    const entries = (parsed.entries || []).map((entry: Record<string, unknown>) => {
      const direction = entry.direction === "in" ? "in" : "out";
      return {
        ...entry,
        direction,
        matched_line_item_id: direction === "out" ? entry.matched_line_item_id : "",
        amount: Math.abs(Number(entry.amount) || 0),
      };
    });

    return new Response(JSON.stringify({
      entries,
      count: entries.length,
      opening_balance: parsed.opening_balance ?? null,
      closing_balance: parsed.closing_balance ?? null,
    }), {
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
