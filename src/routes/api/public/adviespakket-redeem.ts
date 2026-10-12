import { createFileRoute } from "@tanstack/react-router";
import { isAllowedAudience } from "@/lib/adviesEligibility";

/**
 * Server-naar-server (of bureau-frontend) inwisselen van een eenmalige code.
 * Body: { code, code_verifier, audience }. Antwoord uitsluitend { eligible: boolean }.
 */
function cors(origin: string | null): Record<string, string> {
  const h: Record<string, string> = { "Cache-Control": "no-store", "Content-Type": "application/json", Vary: "Origin" };
  if (isAllowedAudience(origin)) {
    h["Access-Control-Allow-Origin"] = origin as string;
    h["Access-Control-Allow-Methods"] = "POST, OPTIONS";
    h["Access-Control-Allow-Headers"] = "content-type";
  }
  return h;
}

export const Route = createFileRoute("/api/public/adviespakket-redeem")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => new Response(null, { status: 204, headers: cors(request.headers.get("origin")) }),
      POST: async ({ request }) => {
        const headers = cors(request.headers.get("origin"));
        const origin = request.headers.get("origin");
        let body: Record<string, unknown> = {};
        try {
          const text = await request.text();
          if (text.length > 2048) throw new Error("too large");
          body = JSON.parse(text);
        } catch {
          return new Response(JSON.stringify({ eligible: false }), { status: 400, headers });
        }
        // Een browser-aanroep met Origin moet exact de audience zijn; server-naar-server heeft geen Origin.
        if (origin && origin !== body["audience"]) {
          return new Response(JSON.stringify({ eligible: false }), { status: 400, headers });
        }
        const clientKey = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
        try {
          const { redeemEligibilityCode } = await import("@/lib/adviesEligibility");
          const { serviceEligibilityStore } = await import("@/lib/adviesEligibility.server");
          const r = await redeemEligibilityCode(await serviceEligibilityStore(), {
            code: body["code"], verifier: body["code_verifier"], audience: body["audience"], clientKey,
          });
          return new Response(JSON.stringify(r.body), { status: r.status, headers });
        } catch {
          return new Response(JSON.stringify({ eligible: false }), { status: 503, headers });
        }
      },
    },
  },
});
