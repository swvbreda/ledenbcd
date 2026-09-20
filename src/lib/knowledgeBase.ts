import type { Session } from "@supabase/supabase-js";

export const KNOWLEDGE_BASE_ENDPOINTS = [
  "/api/leden/kennisbank",
  "https://coffeeshopbond.nl/api/leden/kennisbank",
  "https://id-preview--ad4fe468-a3c4-4d88-8f3f-4515abd526e9.lovable.app/api/leden/kennisbank",
] as const;

export const PUBLIC_DOSSIERS_URL =
  "https://coffeeshopbond.nl/dossiers.json";

export type KnowledgeMetric = {
  label: string;
  waarde: string;
  toelichting?: string;
};

export type KnowledgeSource = {
  titel: string;
  verwijzing: string;
  url?: string;
};

export type KnowledgeQuestion = {
  vraag: string;
  antwoord: string;
};

export type KnowledgeDossier = {
  slug: string;
  path: string;
  titel: string;
  thema: string;
  beschrijving: string;
  standpunt: string;
  kerncijfers: KnowledgeMetric[];
  bronnen: KnowledgeSource[];
  qa: KnowledgeQuestion[];
};

export type KnowledgeDocument = {
  id: string;
  datum: string;
  datumLabel: string;
  titel: string;
  kern: string;
  aan?: string;
  van?: string;
  betekenis?: string;
  soort?: "brief" | "notitie" | "document";
  categorie?: string;
  dossierSlug?: string;
  beschikbaar: boolean;
};

export type KnowledgePayload = {
  dossiers: KnowledgeDossier[];
  documenten: KnowledgeDocument[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function normalizeDossier(
  value: Record<string, unknown>,
): KnowledgeDossier | null {
  const slug = text(value.slug);
  const titel = text(value.titel);
  if (!slug || !titel) return null;

  return {
    slug,
    path: text(value.path, `/publicaties/${slug}`),
    titel,
    thema: text(value.thema, "Kennisdossier"),
    beschrijving: text(value.beschrijving),
    standpunt: text(value.standpunt),
    kerncijfers: Array.isArray(value.kerncijfers)
      ? (value.kerncijfers.filter(isRecord) as unknown as KnowledgeMetric[])
      : [],
    bronnen: Array.isArray(value.bronnen)
      ? (value.bronnen.filter(isRecord) as unknown as KnowledgeSource[])
      : [],
    qa: Array.isArray(value.qa)
      ? (value.qa.filter(isRecord) as unknown as KnowledgeQuestion[])
      : Array.isArray(value.vragen)
        ? (value.vragen.filter(isRecord) as unknown as KnowledgeQuestion[])
        : [],
  };
}

function normalizeDocument(
  value: Record<string, unknown>,
): KnowledgeDocument | null {
  const id = text(value.id);
  const titel = text(value.titel);
  if (!id || !titel) return null;

  return {
    id,
    datum: text(value.datum),
    datumLabel: text(value.datumLabel, text(value.datum)),
    titel,
    kern: text(value.kern),
    aan: text(value.aan) || undefined,
    van: text(value.van, text(value.bron)) || undefined,
    betekenis: text(value.betekenis) || undefined,
    soort:
      value.soort === "notitie" ||
      value.soort === "brief" ||
      value.soort === "document"
        ? value.soort
        : undefined,
    categorie: text(value.categorie) || undefined,
    dossierSlug: text(value.dossierSlug, text(value.dossier)) || undefined,
    beschikbaar:
      value.beschikbaar === true ||
      value.downloadbaar === true ||
      value.available === true ||
      value.hasFile === true,
  };
}

export function parseKnowledgePayload(value: unknown): KnowledgePayload {
  if (!isRecord(value)) throw new Error("Ongeldig antwoord van de kennisbank");

  const nested = isRecord(value.data) ? value.data : value;
  const dossiers = Array.isArray(nested.dossiers) ? nested.dossiers : [];
  const documenten = Array.isArray(nested.documenten)
    ? nested.documenten
    : Array.isArray(nested.documents)
      ? nested.documents
      : [];

  return {
    dossiers: dossiers
      .filter(isRecord)
      .map(normalizeDossier)
      .filter(Boolean) as KnowledgeDossier[],
    documenten: documenten
      .filter(isRecord)
      .map(normalizeDocument)
      .filter(Boolean) as KnowledgeDocument[],
  };
}

async function authorizedRequest(
  endpoint: string,
  session: Session,
  init?: RequestInit,
): Promise<Response> {
  return fetch(endpoint, {
    ...init,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${session.access_token}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  });
}

async function requestWithPreviewFallback(
  session: Session,
  init?: RequestInit,
): Promise<Response> {
  let lastError: Error | null = null;

  for (const endpoint of KNOWLEDGE_BASE_ENDPOINTS) {
    try {
      const response = await authorizedRequest(endpoint, session, init);
      if (response.ok) return response;
      if (
        response.status !== 404 &&
        response.status !== 502 &&
        response.status !== 503
      ) {
        const message = await response.text().catch(() => "");
        throw new Error(
          message || `Kennisbank niet beschikbaar (${response.status})`,
        );
      }
      lastError = new Error(`Kennisbank niet beschikbaar (${response.status})`);
    } catch (error) {
      lastError =
        error instanceof Error
          ? error
          : new Error("Kennisbank niet bereikbaar");
    }
  }

  throw lastError ?? new Error("Kennisbank niet bereikbaar");
}

export async function loadKnowledgeBase(
  session: Session,
): Promise<KnowledgePayload> {
  const [memberResponse, publicResponse] = await Promise.all([
    requestWithPreviewFallback(session),
    fetch(PUBLIC_DOSSIERS_URL, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    }),
  ]);

  if (!publicResponse.ok) {
    throw new Error(`Openbare kennisbank niet beschikbaar (${publicResponse.status})`);
  }

  const memberData = parseKnowledgePayload(await memberResponse.json());
  const publicData = parseKnowledgePayload(await publicResponse.json());

  return {
    dossiers:
      publicData.dossiers.length > 0
        ? publicData.dossiers
        : memberData.dossiers,
    documenten: memberData.documenten,
  };
}

export async function getKnowledgeDocumentUrl(
  session: Session,
  id: string,
): Promise<string> {
  const response = await requestWithPreviewFallback(session, {
    method: "POST",
    body: JSON.stringify({ id }),
  });
  const payload = (await response.json()) as {
    url?: unknown;
    data?: { url?: unknown };
  };
  const url = typeof payload.url === "string" ? payload.url : payload.data?.url;
  if (typeof url !== "string" || !url.startsWith("https://")) {
    throw new Error("Geen geldige downloadlink ontvangen");
  }
  return url;
}
