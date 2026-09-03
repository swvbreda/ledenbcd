import type { Member } from "@/data/types";
import { normalizePhone } from "@/lib/phoneMatch";

export interface CommunityParticipantLike {
  id: string;
  display_name: string;
  phone: string | null;
  member_id: number | null;
}

export interface MatchResult {
  participantId: string;
  participantName: string;
  participantPhone: string | null;
  memberId: number;
  memberLabel: string;
  /** Waarop is gematcht */
  reason: "telefoon" | "naam";
  /** Toelichting, bv. "contactpersoon Michael" of "vestiging Thunderbird". */
  detail: string;
  score: number;
}

export interface MatchSuggestion {
  participantId: string;
  participantName: string;
  participantPhone: string | null;
  /** Beste kandidaten, hoogste score eerst (max 3). */
  candidates: MatchResult[];
  /** Eén duidelijke koploper: veilig voor "Alles bevestigen". */
  isClear: boolean;
}

export interface MatchOutcome {
  /** Zekere matches (telefoonnummer) — direct toepasbaar. */
  certain: MatchResult[];
  /** Waarschijnlijke matches (naam) — ter bevestiging. */
  suggested: MatchSuggestion[];
}

export function memberLabel(m: Member): string {
  return m.naam || m.bedrijfsnaam || `Lid #${m.id}`;
}

/** Normaliseer een naam: lowercase, zonder ~-prefix, zonder diacrieten en leestekens. */
export function normalizeName(raw: string | null | undefined): string {
  if (!raw) return "";
  return String(raw)
    .replace(/^[~\s]+/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Woorden die niets zeggen over wie of welke shop het is. */
const NOISE = new Set([
  "coffeeshop",
  "coffeshop",
  "koffieshop",
  "koffiehuis",
  "shop",
  "cafe",
  "bv",
  "vof",
  "the",
  "de",
  "het",
  "een",
  "van",
  "der",
  "den",
  "vd",
  "el",
  "al",
  "en",
  "co",
]);

export function nameTokens(raw: string | null | undefined): string[] {
  return normalizeName(raw)
    .split(" ")
    .filter((t) => t.length >= 3 && !NOISE.has(t) && !/^\d+$/.test(t));
}

/** Telefoonnummers van een lid (hoofdnummer, tweede nummer, contacten, vestigingen). */
function memberPhones(m: Member): string[] {
  const raw: (string | undefined)[] = [
    m.telefoon,
    m.telefoon2,
    m.factuurTelefoon,
    ...(m.contacten ?? []).map((c) => c?.telefoon),
    ...(m.locaties ?? []).map((l) => l?.telefoon),
  ];
  const out: string[] = [];
  for (const r of raw) {
    const n = normalizePhone(r);
    if (n) out.push(n);
  }
  return out;
}

/** Namen van personen bij een lid. */
function personNames(m: Member): string[] {
  return [
    m.contactpersoon,
    m.contactpersoon2,
    ...(m.contactpersonen ?? []),
    ...(m.contacten ?? []).map((c) => c?.naam),
  ].filter((v): v is string => !!v && v.trim().length > 0);
}

/** Namen van het lid zelf en zijn vestigingen. */
function shopNames(m: Member): string[] {
  return [m.naam, m.bedrijfsnaam, ...(m.locaties ?? []).map((l) => l?.naam)].filter(
    (v): v is string => !!v && v.trim().length > 0,
  );
}

type Scored = { score: number; detail: string };

/** Scoor hoe goed een weergavenaam bij een lid past. */
function scoreMember(tokens: string[], m: Member): Scored | null {
  const set = new Set(tokens);
  let score = 0;
  const details: string[] = [];

  for (const shop of shopNames(m)) {
    const st = nameTokens(shop).filter((t) => t.length >= 4);
    const hits = st.filter((t) => set.has(t));
    if (hits.length > 0) {
      score += 6 * hits.length;
      details.push(`vestiging ${shop}`);
      break;
    }
  }

  let bestPerson: { hits: number; naam: string } | null = null;
  for (const person of personNames(m)) {
    const pt = nameTokens(person);
    const hits = pt.filter((t) => set.has(t)).length;
    if (hits > 0 && (!bestPerson || hits > bestPerson.hits)) {
      bestPerson = { hits, naam: person };
    }
  }
  if (bestPerson) {
    score += bestPerson.hits >= 2 ? 5 : 2;
    details.push(`contactpersoon ${bestPerson.naam}`);
  }

  if (score === 0) return null;
  return { score, detail: details.join(" · ") };
}

/**
 * Koppel deelnemers aan leden op telefoonnummer (zeker) en op naam (voorstel).
 * Naamvoorstellen kijken naar contactpersonen én naar shop-/vestigingsnamen die
 * in de WhatsApp-weergavenaam voorkomen; meerdere kandidaten blijven zichtbaar.
 */
export function matchParticipants(
  participants: CommunityParticipantLike[],
  members: Member[],
): MatchOutcome {
  const phoneIndex = new Map<string, Member[]>();
  for (const m of members) {
    for (const p of memberPhones(m)) {
      const list = phoneIndex.get(p);
      if (list) {
        if (!list.some((x) => x.id === m.id)) list.push(m);
      } else phoneIndex.set(p, [m]);
    }
  }

  const certain: MatchResult[] = [];
  const suggested: MatchSuggestion[] = [];

  for (const p of participants) {
    if (p.member_id) continue;

    const phone = normalizePhone(p.phone);
    const byPhone = phone ? phoneIndex.get(phone) : undefined;
    if (byPhone && byPhone.length === 1) {
      certain.push({
        participantId: p.id,
        participantName: p.display_name,
        participantPhone: p.phone,
        memberId: byPhone[0].id,
        memberLabel: memberLabel(byPhone[0]),
        reason: "telefoon",
        detail: "telefoonnummer komt overeen",
        score: 100,
      });
      continue;
    }

    const tokens = nameTokens(p.display_name);
    if (tokens.length === 0) continue;

    const scored: MatchResult[] = [];
    for (const m of members) {
      const s = scoreMember(tokens, m);
      if (!s) continue;
      scored.push({
        participantId: p.id,
        participantName: p.display_name,
        participantPhone: p.phone,
        memberId: m.id,
        memberLabel: memberLabel(m),
        reason: "naam",
        detail: s.detail,
        score: s.score,
      });
    }
    if (scored.length === 0) continue;

    scored.sort((a, b) => b.score - a.score || a.memberLabel.localeCompare(b.memberLabel));
    const candidates = scored.slice(0, 3);
    suggested.push({
      participantId: p.id,
      participantName: p.display_name,
      participantPhone: p.phone,
      candidates,
      isClear:
        candidates.length === 1 ||
        (candidates[0].score >= 5 && candidates[0].score > candidates[1].score),
    });
  }

  return { certain, suggested };
}
