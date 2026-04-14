import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

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
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return new Response(JSON.stringify({ error: "No file provided" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Member list for matching
    const membersJson = formData.get("members") as string | null;
    let membersContext = "";
    if (membersJson) {
      try {
        const members = JSON.parse(membersJson) as Array<{ id: number; naam: string }>;
        membersContext = `\n\nBeschikbare leden (id → naam):\n${members.map(m => `- ${m.id}: ${m.naam}`).join("\n")}\n\nProbeer de naam op de factuur te matchen met een van deze leden. Geef het id terug in matched_member_id.`;
      } catch { /* ignore */ }
    }

    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let base64 = "";
    const CHUNK = 32768;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      base64 += base64Encode(bytes.subarray(i, Math.min(i + CHUNK, bytes.length)));
    }

    const systemPrompt = `Je bent een financiële data-extractor. Je analyseert contributie-facturen (PDF) van een coffeeshopbond en extraheert:
- Het factuurnummer
- De naam van het lid / de coffeeshop / het bedrijf op de factuur
- Het lidnummer als dat op de factuur staat

Zoek naar patronen als "Factuurnummer:", "Factuur nr.", "Lidnummer:", "#", etc.${membersContext}`;

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
              { type: "text", text: "Extraheer het factuurnummer en het lid uit deze contributie-factuur." },
              { type: "image_url", image_url: { url: `data:application/pdf;base64,${base64}` } },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_invoice_info",
              description: "Extract invoice number and member info from a contribution invoice PDF",
              parameters: {
                type: "object",
                properties: {
                  invoice_number: { type: "string", description: "The invoice number found on the PDF" },
                  member_name: { type: "string", description: "Name of the member/coffeeshop/company on the invoice" },
                  member_number: { type: "integer", description: "Member/lid number if found on the invoice" },
                  matched_member_id: { type: "integer", description: "ID of the best matching member from the provided list" },
                  confidence: { type: "string", enum: ["high", "medium", "low"], description: "Confidence level of the member match" },
                },
                required: ["invoice_number"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_invoice_info" } },
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

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-contribution-invoice error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Onbekende fout" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
