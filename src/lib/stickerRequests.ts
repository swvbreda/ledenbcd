import { ADDRESS_GROUP_SURVEY_IDS } from "./surveyAddressGroup";

export const STICKER_SURVEY_ID = "48979e13-3dcf-4ed4-abbe-e2f3d365b658";
export const isStickerSurvey = (id: string | undefined) => !!id && id === STICKER_SURVEY_ID && ADDRESS_GROUP_SURVEY_IDS.has(id);
export const STICKER_NOTICE = "De BCD registreert je naam en coffeeshop om de stickers te versturen.";
export const ONBEKEND = "Onbekend";

type Q = { id: string; question_text: string; sort_order: number };
type R = { question_id: string; submitted_at: string; answer: Record<string, unknown> | null };

export type StickerRequest = {
  key: string; datum: string; aanvrager: string; coffeeshop: string; vestiging: string; jaren: string; vestigingen: string;
  ontvanger: string; straat: string; huisnummer: string; toevoeging: string; postcode: string; plaats: string; bron: string;
};

const str = (v: unknown) => (Array.isArray(v) ? v.filter(Boolean).join(", ") : typeof v === "string" ? v.trim() : v == null ? "" : String(v));
const or = (s: string) => s || ONBEKEND;

/** Oude WhatsApp-tekst "Naam — Shop, Plaats (jaartallen nog te bevestigen)" → shop, of onbekend. Nooit verzinnen. */
export function legacyCoffeeshop(text: string): string {
  const i = text.indexOf(" — ");
  if (i < 0) return "";
  const rest = text.slice(i + 3).replace(/\s*\(jaartallen nog te bevestigen\)\s*$/i, "").replace(/,?\s*vestiging nog te bevestigen\s*$/i, "").trim();
  return /^vestiging nog te bevestigen$/i.test(rest) ? "" : rest.replace(/,\s*$/, "");
}

/** Eén rij per aanvraag (request_id; oude inzendingen per tijdstempel). */
export function stickerRequests(questions: readonly Q[], responses: readonly R[]): StickerRequest[] {
  const qs = [...questions].sort((a, b) => a.sort_order - b.sort_order);
  const byTitle = (t: string) => qs.find((q) => q.question_text.trim() === t)?.id;
  const [qVest, qJaren, qOntv] = qs;
  const groups = new Map<string, R[]>();
  for (const r of responses) {
    const k = typeof r.answer?.["request_id"] === "string" ? (r.answer["request_id"] as string) : `t-${r.submitted_at}`;
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  return [...groups.entries()].map(([key, rows]) => {
    const val = (qid?: string) => str(rows.find((r) => r.question_id === qid)?.answer?.["value"]);
    const meta = (f: string) => str(rows.find((r) => r.answer?.[f])?.answer?.[f]);
    const isNew = !!meta("coffeeshop");
    const ontvangerRaw = val(qOntv?.id);
    return {
      key, datum: rows[0]!.submitted_at,
      aanvrager: or(meta("aanvrager")),
      coffeeshop: or(isNew ? meta("coffeeshop") : legacyCoffeeshop(ontvangerRaw)),
      vestiging: meta("location"),
      jaren: or(val(qJaren?.id)), vestigingen: or(val(qVest?.id)),
      ontvanger: or(isNew ? ontvangerRaw : ""),
      straat: or(val(byTitle("Straatnaam"))), huisnummer: or(val(byTitle("Huisnummer"))),
      toevoeging: val(byTitle("Toevoeging")), postcode: or(val(byTitle("Postcode"))), plaats: or(val(byTitle("Plaats"))),
      bron: meta("source") || ONBEKEND,
    };
  }).sort((a, b) => a.datum.localeCompare(b.datum));
}

export const STICKER_CSV_HEADERS = ["Datum", "Naam aanvrager", "Naam coffeeshop", "Vestiging", "Gewenste jaren", "Aantal vestigingen", "Afleveren t.a.v.", "Straatnaam", "Huisnummer", "Toevoeging", "Postcode", "Plaats", "Bron"];
export function stickerCsv(rows: readonly StickerRequest[]): string {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  return [STICKER_CSV_HEADERS, ...rows.map((r) => [r.datum.slice(0, 16).replace("T", " "), r.aanvrager, r.coffeeshop, r.vestiging, r.jaren, r.vestigingen, r.ontvanger, r.straat, r.huisnummer, r.toevoeging, r.postcode, r.plaats, r.bron])]
    .map((l) => l.map(esc).join(",")).join("\n");
}

/** Vooraf invullen alleen als eenduidig; anders leeg laten. */
export function stickerPrefill(email: string | null | undefined, members: readonly { naam: string; email?: string; contactpersoon?: string; contacten?: { naam: string; email: string }[] }[]) {
  const coffeeshop = members.length === 1 ? members[0]!.naam.trim() : "";
  const e = (email ?? "").trim().toLowerCase();
  const names = new Set<string>();
  if (e) for (const m of members) {
    for (const c of m.contacten ?? []) if (c.email?.trim().toLowerCase() === e && c.naam?.trim()) names.add(c.naam.trim());
    if (m.email?.trim().toLowerCase() === e && m.contactpersoon?.trim()) names.add(m.contactpersoon.trim());
  }
  return { aanvrager: names.size === 1 ? [...names][0]! : "", coffeeshop };
}
