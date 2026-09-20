import { createFileRoute } from "@tanstack/react-router";

const KNOWLEDGE_API = "https://coffeeshopbond.nl/api/leden/kennisbank";

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "private, no-store",
    },
  });
}

async function proxyKnowledgeRequest(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return jsonError("Niet ingelogd als lid", 401);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const upstream = await fetch(KNOWLEDGE_API, {
      method: request.method,
      headers: {
        Accept: "application/json",
        Authorization: authorization,
        ...(request.method === "POST"
          ? { "Content-Type": "application/json" }
          : {}),
      },
      body: request.method === "POST" ? await request.text() : undefined,
      cache: "no-store",
      signal: controller.signal,
    });

    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "Content-Type":
          upstream.headers.get("content-type") ?? "application/json",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("kennisbank proxy", error);
    return jsonError("Kennisbank tijdelijk niet bereikbaar", 502);
  } finally {
    clearTimeout(timeout);
  }
}

export const Route = createFileRoute("/api/leden/kennisbank")({
  server: {
    handlers: {
      GET: ({ request }) => proxyKnowledgeRequest(request),
      POST: ({ request }) => proxyKnowledgeRequest(request),
    },
  },
});
