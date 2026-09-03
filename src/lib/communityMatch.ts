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
}

export interface MatchOutcome {
  /** Zekere matches (telefoonnummer) — direct toepasbaar. */
  certain: MatchResult[];
  /** Waarschijnlijke matches (naam) — ter bevestiging. */
  suggested: MatchResult[];
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

/** Namen van een lid waarop een WhatsApp-weergavenaam kan matchen. */
function memberNames(m: Member): string[] {
  const raw: (string | undefined)[] = [
    m.contactpersoon,
    m.contactpersoon2,
    ...(m.contactpersonen ?? []),
    ...(m.contacten ?? []).map((c) => c?.naam),
    m.naam,
    m.bedrijfsnaam,
    ...(m.locaties ?? []).map((l) => l?.naam),
  ];
  const out: string[] = [];
  for (const r of raw) {
    const n = normalizeName(r);
    if (n) out.push(n);
  }
  return out;
}

/**
 * Koppel deelnemers aan leden op telefoonnummer (zeker) en op naam (voorstel).
 * Alleen deelnemers zonder member_id worden bekeken. Naam-matches tellen enkel
 * als de naam minimaal 4 tekens telt en precies één lid in aanmerking komt.
 */
export function matchParticipants(
  participants: CommunityParticipantLike[],
  members: Member[],
): MatchOutcome {
  const phoneIndex = new Map<string, Member[]>();
  const nameIndex: { name: string; member: Member }[] = [];

  for (const m of members) {
    for (const p of memberPhones(m)) {
      const list = phoneIndex.get(p);
      if (list) {
        if (!list.some((x) => x.id === m.id)) list.push(m);
      } else phoneIndex.set(p, [m]);
    }
    for (const n of memberNames(m)) nameIndex.push({ name: n, member: m });
  }

  const certain: MatchResult[] = [];
  const suggested: MatchResult[] = [];

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
      });
      continue;
    }

    const nm = normalizeName(p.display_name);
    if (nm.length < 4 || /^\d+$/.test(nm.replace(/\s/g, ""))) continue;

    const hits = new Map<number, Member>();
    for (const entry of nameIndex) {
      if (entry.name === nm || entry.name.includes(nm) || nm.includes(entry.name)) {
        hits.set(entry.member.id, entry.member);
      }
    }
    if (hits.size === 1) {
      const m = [...hits.values()][0];
      suggested.push({
        participantId: p.id,
        participantName: p.display_name,
        participantPhone: p.phone,
        memberId: m.id,
        memberLabel: memberLabel(m),
        reason: "naam",
      });
    }
  }

  return { certain, suggested };
}
