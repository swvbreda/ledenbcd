import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { gemeentenaam, documents } = await req.json();
    if (!gemeentenaam || !documents?.length) {
      return new Response(JSON.stringify({ error: "gemeentenaam and documents required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Build a concise context from the documents
    const docSummaries = documents.slice(0, 15).map((d: any, i: number) => {
      const parts = [`${i + 1}. "${d.name}"`];
      if (d.date) parts.push(`(${d.date})`);
      if (d.description) parts.push(`- ${d.description}`);
      if (d.organization) parts.push(`[${d.organization}]`);
      return parts.join(" ");
    }).join("\n");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `Je bent een expert in Nederlands cannabisbeleid. Analyseer gemeentelijke beleidsdocumenten en extraheer de belangrijkste feiten.

Antwoord UITSLUITEND als JSON-object met tool calling. Vul "onbekend" in als iets niet te achterhalen is uit de documenten.`,
          },
          {
            role: "user",
            content: `Analyseer de volgende beleidsdocumenten van gemeente ${gemeentenaam} en extraheer de kerngegevens over het coffeeshopbeleid:\n\n${docSummaries}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_policy_summary",
              description: "Extraheer de kerngegevens van het coffeeshopbeleid van een gemeente",
              parameters: {
                type: "object",
                properties: {
                  beleidsmaximum: {
                    type: "string",
                    description: "Het maximale aantal coffeeshops dat de gemeente toestaat (getal of 'onbekend')",
                  },
                  feitelijk_aantal: {
                    type: "string",
                    description: "Het huidige feitelijke aantal coffeeshops in de gemeente (getal of 'onbekend')",
                  },
                  beleidsstatus: {
                    type: "string",
                    enum: ["gedoogbeleid", "nulbeleid", "uitsterfbeleid", "onbekend"],
                    description: "Type beleid dat de gemeente voert",
                  },
                  afstandscriterium: {
                    type: "string",
                    description: "Eventueel afstandscriterium tot scholen/voorzieningen, bijv. '250 meter' of 'onbekend'",
                  },
                  samenvatting: {
                    type: "string",
                    description: "Korte samenvatting van het beleid in 1-2 zinnen",
                  },
                  bronnen: {
                    type: "array",
                    items: { type: "string" },
                    description: "Namen van de documenten waarop de analyse is gebaseerd",
                  },
                },
                required: ["beleidsmaximum", "feitelijk_aantal", "beleidsstatus", "afstandscriterium", "samenvatting", "bronnen"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_policy_summary" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit bereikt, probeer later opnieuw." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI-credits op, voeg credits toe." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      throw new Error("No structured output from AI");
    }

    const summary = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("summarize-municipal-policy error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
