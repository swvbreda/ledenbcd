import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  effectiveMember,
  findByLinkKey,
  isLocationDeleted,
  locationKeyOf,
  locationTarget,
  realLocationCount,
  sameFieldValue,
} from "../_shared/memberEffective.ts";

/**
 * Vult ledengegevens aan met data uit het landelijke coffeeshopregister.
 *
 * - Bevestigde koppelingen die nog geen locatie bij het lid hebben, worden als
 *   locatie toegevoegd.
 * - Lege velden (adres, postcode, plaats, stadsdeel/gemeente, website, telefoon,
 *   oprichtingsdatum) worden automatisch gevuld — bestaande waarden nooit
 *   overschreven; afwijkingen komen als voorstel in register_enrichment_proposals.
 * - De oprichtdatum van een vestiging komt uit het KvK-VESTIGINGSprofiel (datum
 *   aanvang van die vestiging), nooit uit de registratiedatum van het bedrijf:
 *   anders krijgen alle vestigingen van dezelfde B.V. dezelfde datum. Kan de
 *   vestiging niet eenduidig op postcode + huisnummer worden gevonden, dan blijft
 *   de datum leeg. Secret: KVK_API_KEY; zonder sleutel wordt dit overgeslagen.
 */

const KVK_SEARCH = "https://api.kvk.nl/api/v2/zoeken";
const KVK_PROFILE = "https://api.kvk.nl/api/v1/basisprofielen";
const KVK_VESTIGING = "https://api.kvk.nl/api/v1/vestigingsprofielen";

function admin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

const norm = (v: unknown) =>
  String(v ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const normPc = (v: unknown) => String(v ?? "").toUpperCase().replace(/\s+/g, "");

/** Verwijdert tracking-parameters en fragmenten uit een URL. */
const cleanWebsite = (url: string | null | undefined): string | null => {
  const raw = (url ?? "").trim();
  if (!raw) return null;
  return raw.split(/[?#]/)[0].replace(/\/$/, "") || null;
};

function shopAddress(shop: any): string {
  return [shop.straat, [shop.huisnummer, shop.huisnummer_toevoeging].filter(Boolean).join("")]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function shopHouseNumber(shop: any): string {
  return String(shop.huisnummer ?? "").replace(/\D+/g, "");
}

function locHouseNumber(adres: string | undefined): string {
  const m = String(adres ?? "").match(/(\d+)/);
  return m ? m[1] : "";
}

/** Bepaalt of een bestaande locatie dezelfde vestiging is als de registershop. */
function sameLocation(loc: any, shop: any): boolean {
  const pcA = normPc(loc?.postcode);
  const pcB = normPc(shop.postcode);
  if (pcA && pcB && pcA === pcB && locHouseNumber(loc?.adres) === shopHouseNumber(shop)) return true;
  const nA = norm(loc?.naam);
  const nB = norm(shop.naam);
  if (nA && nA === nB) {
    const plA = norm(loc?.plaats);
    const plB = norm(shop.plaats);
    if (!plA || !plB || plA === plB) return true;
  }
  return false;
}

/** Factuurvelden worden nooit door het register aangeraakt. */
function isInvoiceField(field: string): boolean {
  return field.toLowerCase().startsWith("factuur");
}

/** Registerwaarde voor een veld van een vestiging. */
function registerValueFor(shop: any, field: string): string | null {
  const socials = (shop?.socials ?? {}) as Record<string, string | null>;
  const shopLogo =
    typeof shop?.logo_url === "string" && /^https?:\/\//i.test(shop.logo_url) ? shop.logo_url : null;
  switch (field) {
    case "adres":
      return shopAddress(shop) || null;
    case "postcode":
      return shop?.postcode ?? null;
    case "plaats":
      return shop?.plaats ?? null;
    case "gemeente":
      return shop?.gemeente ?? null;
    case "naam":
      return shop?.naam ?? null;
    case "oprichtingsDatum":
      return shop?.kvk_vestiging_datum ?? null;
    case "kvk":
      return shop?.kvk_nummer ?? null;
    case "vergunninghouder":
      return shop?.vergunninghouder ?? null;
    case "exploitant":
      return shop?.exploitant ?? null;
    case "website":
      return cleanWebsite(shop?.website);
    case "telefoon":
      return shop?.telefoon ?? null;
    case "logo":
      return shopLogo;
    case "instagram":
      return socials.instagram ?? null;
    case "facebook":
      return socials.facebook ?? null;
    default:
      return null;
  }
}

type Proposal = {
  member_id: number;
  register_id: string | null;
  scope: string;
  location_key: string | null;
  field: string;
  current_value: string | null;
  proposed_value: string;
  source: string;
};

/** Haalt de inschrijvingsdatum (oprichting) op bij de KvK. */
async function kvkLookup(
  apiKey: string,
  shop: any,
): Promise<{ kvkNummer: string | null; datum: string | null }> {
  const headers = { apikey: apiKey, Accept: "application/json" };

  let kvkNummer: string | null = shop.kvk_nummer ?? null;

  if (!kvkNummer) {
    const params = new URLSearchParams();
    const naam = shop.vergunninghouder || shop.exploitant || shop.naam;
    if (naam) params.set("naam", String(naam));
    if (shop.postcode) params.set("postcode", normPc(shop.postcode));
    if (shopHouseNumber(shop)) params.set("huisnummer", shopHouseNumber(shop));
    if (!params.toString()) return { kvkNummer: null, datum: null };

    const res = await fetch(`${KVK_SEARCH}?${params}`, { headers });
    if (!res.ok) {
      console.warn("KvK zoeken mislukt", res.status, await res.text().catch(() => ""));
      return { kvkNummer: null, datum: null };
    }
    const json = await res.json().catch(() => null);
    const items: any[] = json?.resultaten ?? [];
    if (items.length !== 1) return { kvkNummer: null, datum: null }; // onzeker -> overslaan
    kvkNummer = items[0]?.kvkNummer ?? null;
  }

  if (!kvkNummer) return { kvkNummer: null, datum: null };

  const res = await fetch(`${KVK_PROFILE}/${kvkNummer}`, { headers });
  if (!res.ok) {
    console.warn("KvK basisprofiel mislukt", res.status);
    return { kvkNummer, datum: null };
  }
  const prof = await res.json().catch(() => null);
  const raw: string | null =
    prof?.formeleRegistratiedatum ?? prof?.materieleRegistratie?.datumAanvang ?? null;
  if (!raw) return { kvkNummer, datum: null };
  const s = String(raw).replace(/-/g, "");
  if (s.length !== 8) return { kvkNummer, datum: null };
  return { kvkNummer, datum: `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` };
}

function toIsoDate(raw: unknown): string | null {
  const s = String(raw ?? "").replace(/-/g, "");
  if (s.length !== 8) return null;
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

/**
 * Haalt de startdatum van DEZE vestiging op via het KvK-vestigingsprofiel.
 * Alleen bij precies één zoekresultaat op postcode + huisnummer, anders null.
 */
async function kvkVestigingLookup(
  apiKey: string,
  shop: any,
): Promise<{ vestigingsnummer: string | null; datum: string | null }> {
  const headers = { apikey: apiKey, Accept: "application/json" };
  const postcode = normPc(shop.postcode);
  const huisnummer = shopHouseNumber(shop);
  if (!postcode || !huisnummer) return { vestigingsnummer: null, datum: null };

  const params = new URLSearchParams({
    postcode,
    huisnummer,
    type: "hoofdvestiging,nevenvestiging",
  });
  if (shop.kvk_nummer) params.set("kvkNummer", String(shop.kvk_nummer));

  const res = await fetch(`${KVK_SEARCH}?${params}`, { headers });
  if (!res.ok) {
    console.warn("KvK vestiging zoeken mislukt", res.status);
    return { vestigingsnummer: null, datum: null };
  }
  const json = await res.json().catch(() => null);
  const items: any[] = (json?.resultaten ?? []).filter((r: any) => r?.vestigingsnummer);
  const uniek = Array.from(new Set(items.map((r: any) => String(r.vestigingsnummer))));
  if (uniek.length !== 1) return { vestigingsnummer: null, datum: null }; // onzeker -> overslaan

  const vestigingsnummer = uniek[0];
  const profRes = await fetch(`${KVK_VESTIGING}/${vestigingsnummer}`, { headers });
  if (!profRes.ok) {
    console.warn("KvK vestigingsprofiel mislukt", profRes.status);
    return { vestigingsnummer, datum: null };
  }
  const prof = await profRes.json().catch(() => null);
  const datum = toIsoDate(prof?.formeleRegistratiedatum ?? prof?.materieleRegistratie?.datumAanvang);
  return { vestigingsnummer, datum };
}



Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const internal = Deno.env.get("INTERNAL_WEBHOOK_SECRET");
  const auth = req.headers.get("authorization") ?? "";
  const providedInternal = req.headers.get("x-internal-secret");
  const isService = auth === `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`;
  if (!isService && (!internal || providedInternal !== internal)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const db = admin();
  const kvkKey = Deno.env.get("KVK_API_KEY") ?? "";

  // Optionele afbakening: één lid en/of één registervestiging bijwerken.
  const body = await req.json().catch(() => null);
  const scopeMemberId = Number.isFinite(Number(body?.member_id)) ? Number(body.member_id) : null;
  const scopeRegisterId = typeof body?.register_id === "string" && body.register_id
    ? body.register_id
    : null;

  try {
    let linkQuery = db
      .from("coffeeshop_member_links")
      .select("register_id, member_id, status, location_key")
      .eq("status", "bevestigd");
    if (scopeMemberId !== null) linkQuery = linkQuery.eq("member_id", scopeMemberId);
    if (scopeRegisterId) linkQuery = linkQuery.eq("register_id", scopeRegisterId);
    const { data: links, error: linkErr } = await linkQuery;

    if (linkErr) throw linkErr;


    const registerIds = Array.from(new Set((links ?? []).map((l: any) => l.register_id)));
    if (registerIds.length === 0) {
      return new Response(JSON.stringify({ ok: true, membersUpdated: 0, proposals: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const shops: any[] = [];
    for (let i = 0; i < registerIds.length; i += 200) {
      const { data, error } = await db
        .from("coffeeshop_register")
        .select("*")
        .in("id", registerIds.slice(i, i + 200));
      if (error) throw error;
      shops.push(...(data ?? []));
    }
    const shopById = new Map(shops.map((s) => [s.id, s]));

    // Eigendomsketen (UBO) per registerrij ophalen
    const uboByRegister = new Map<string, any[]>();
    for (let i = 0; i < registerIds.length; i += 200) {
      const { data: uboRows } = await db
        .from("coffeeshop_register_ubo")
        .select("register_id, niveau, naam, kvk_nummer, soort, is_uiteindelijk, toelichting")
        .in("register_id", registerIds.slice(i, i + 200))
        .order("niveau");
      for (const u of uboRows ?? []) {
        const arr = uboByRegister.get((u as any).register_id) ?? [];
        arr.push({
          naam: (u as any).naam,
          kvk: (u as any).kvk_nummer ?? null,
          niveau: (u as any).niveau,
          soort: (u as any).soort,
          uiteindelijkBelanghebbende: !!(u as any).is_uiteindelijk,
          toelichting: (u as any).toelichting ?? null,
        });
        uboByRegister.set((u as any).register_id, arr);
      }
    }

    // KvK-verrijking (max 40 shops per run, gecached op de registerrij)
    let kvkLookups = 0;
    if (kvkKey) {
      const todo = shops.filter((s) => !s.kvk_oprichtingsdatum && !s.kvk_checked_at).slice(0, 40);
      for (const shop of todo) {
        try {
          const { kvkNummer, datum } = await kvkLookup(kvkKey, shop);
          await db
            .from("coffeeshop_register")
            .update({
              kvk_nummer: kvkNummer ?? shop.kvk_nummer ?? null,
              kvk_oprichtingsdatum: datum,
              kvk_checked_at: new Date().toISOString(),
            })
            .eq("id", shop.id);
          shop.kvk_nummer = kvkNummer ?? shop.kvk_nummer ?? null;
          shop.kvk_oprichtingsdatum = datum;
          kvkLookups++;
        } catch (e) {
          console.warn("KvK lookup fout", shop.id, String(e));
        }
      }

      // Startdatum per vestiging (vestigingsprofiel), max 40 per run
      const vestTodo = shops
        .filter((s) => !s.kvk_vestiging_datum && !s.kvk_vestiging_checked_at)
        .slice(0, 40);
      for (const shop of vestTodo) {
        try {
          const { vestigingsnummer, datum } = await kvkVestigingLookup(kvkKey, shop);
          await db
            .from("coffeeshop_register")
            .update({
              kvk_vestigingsnummer: vestigingsnummer,
              kvk_vestiging_datum: datum,
              kvk_vestiging_checked_at: new Date().toISOString(),
            })
            .eq("id", shop.id);
          shop.kvk_vestigingsnummer = vestigingsnummer;
          shop.kvk_vestiging_datum = datum;
          kvkLookups++;
        } catch (e) {
          console.warn("KvK vestiging lookup fout", shop.id, String(e));
        }
      }
    }


    // Openstaande/genegeerde voorstellen zodat we niets dubbel of opnieuw voorstellen
    const { data: existingProposals } = await db
      .from("register_enrichment_proposals")
      .select(
        "id, member_id, register_id, location_key, field, status, scope, current_value, proposed_value",
      );
    const knownProposal = new Set(
      (existingProposals ?? []).map(
        (p: any) => `${p.member_id}|${p.register_id ?? ""}|${p.location_key ?? ""}|${p.field}`,
      ),
    );
    // Een koppeling wijst precies één vestiging aan: dedupliceer daarom op
    // (lid, registershop, veld). De locatiesleutel verschuift bij een verhuizing
    // en mag dus geen dubbele of teruggekeerde voorstellen veroorzaken.
    const knownByLink = new Map<string, any>();
    const openByMember = new Map<number, any[]>();
    for (const p of existingProposals ?? []) {
      if ((p as any).status === "open") {
        const arr = openByMember.get(p.member_id) ?? [];
        arr.push(p);
        openByMember.set(p.member_id, arr);
      }
      if ((p as any).scope !== "locatie" || !(p as any).register_id) continue;
      knownByLink.set(`${p.member_id}|${p.register_id}|${p.field}`, p);
    }
    /** Voorstellen waarvan de locatiesleutel of registerwaarde is verschoven. */
    const proposalUpdates: Array<{ id: string; patch: Record<string, unknown> }> = [];
    /** Voorstellen die inmiddels zijn verwerkt (ledengegevens = registerwaarde). */
    const proposalClosures: Array<{ id: string; reden: string }> = [];
    /** Bevestigde koppelingen waarvan de locatiesleutel is verouderd. */
    const linkKeyFixes: Array<{ member_id: number; register_id: string; location_key: string }> =
      [];
    let linksNeedingReview = 0;

    const byMember = new Map<number, Array<{ rid: string; linkKey: string | null }>>();
    for (const l of links ?? []) {
      const arr = byMember.get(l.member_id) ?? [];
      arr.push({ rid: l.register_id, linkKey: (l as any).location_key ?? null });
      byMember.set(l.member_id, arr);
    }


    const proposals: Proposal[] = [];
    let membersUpdated = 0;
    let locationsAdded = 0;
    let fieldsFilled = 0;

    for (const [memberId, shopIds] of byMember) {
      const { data: row, error: memErr } = await db
        .from("members_data")
        .select("id, data")
        .eq("id", memberId)
        .maybeSingle();
      if (memErr) throw memErr;
      if (!row) continue;

      const { data: editRow, error: editErr } = await db
        .from("member_edits")
        .select("member_id, data")
        .eq("member_id", memberId)
        .maybeSingle();
      if (editErr) throw editErr;

      // Basis en goedgekeurde wijzigingen blijven gescheiden; de verrijking
      // redeneert uitsluitend over de effectieve (samengevoegde) ledengegevens.
      const baseData: any = JSON.parse(JSON.stringify(row.data ?? {}));
      if (!Array.isArray(baseData.locaties)) baseData.locaties = [];
      const overlayData: any = editRow?.data
        ? JSON.parse(JSON.stringify(editRow.data))
        : null;
      if (overlayData && !Array.isArray(overlayData.locaties)) overlayData.locaties = [];

      const eff = effectiveMember(baseData, overlayData);
      const locaties: any[] = eff.locaties;
      let baseChanged = false;
      let overlayChanged = false;

      /**
       * Vult een leeg veld aan in de laag waar de vestiging staat: correcties
       * van het lid blijven in member_edits, registerdata vult de basis aan.
       */
      const fillLocationField = (loc: any, field: string, value: string) => {
        const target = locationTarget(baseData, overlayData, loc);
        if (target?.layer === "overlay" && overlayData) {
          overlayData.locaties[target.index][field] = value;
          overlayChanged = true;
        } else if (target?.layer === "base") {
          baseData.locaties[target.index][field] = value;
          baseChanged = true;
        } else {
          return false;
        }
        loc[field] = value;
        return true;
      };

      // Oude voorstellen van vóór de locatie-verrijking mogen gegevens van een
      // meerlocatielid niet meer op lidniveau wijzigen. KvK, vergunninghouders
      // en bedrijfsnamen horen dan uitsluitend op de betreffende vestiging.
      if (realLocationCount(locaties) > 1) {
        const { error: staleErr } = await db
          .from("register_enrichment_proposals")
          .update({
            status: "genegeerd",
            resolved_at: new Date().toISOString(),
            resolutie_reden: "lid heeft meerdere vestigingen; alleen locatievoorstellen gelden",
          })
          .eq("member_id", memberId)
          .neq("scope", "locatie")
          .eq("status", "open");
        if (staleErr) console.warn("oude algemene voorstellen opschonen mislukt:", staleErr.message);
      }

      for (const { rid, linkKey } of shopIds) {
        const shop = shopById.get(rid);
        if (!shop || shop.vervallen) continue;

        // De bevestigde koppeling is leidend: die wijst de bestaande vestiging
        // aan, ook wanneer de shop in het register is verhuisd. Pas als de
        // sleutel niets oplevert, zoeken we op adres/naam.
        const matches = locaties.filter((l) => sameLocation(l, shop));
        let loc = findByLinkKey(locaties, linkKey) ?? (matches.length === 1 ? matches[0] : null);
        if (!loc && matches.length > 1) {
          // Meerdere kandidaten: nooit gokken, dit vraagt menselijke beoordeling.
          linksNeedingReview++;
          continue;
        }
        // De sleutel verwijst naar de bestaande ledenlocatie. Gebruik daarom de
        // huidige gegevens van die locatie, niet het mogelijk gewijzigde registeradres.
        const locKey = loc
          ? linkKey || normPc(loc.postcode) || norm(loc.naam)
          : normPc(shop.postcode) || norm(shop.naam);

        // Bevestigde koppeling blijft op dezelfde register_id hangen; alleen een
        // verouderde locatiesleutel wordt bijgewerkt naar de effectieve locatie.
        if (loc) {
          const effKey = locationKeyOf(loc);
          if (effKey !== "||" && (linkKey ?? "") !== effKey && !findByLinkKey([loc], linkKey)) {
            linkKeyFixes.push({ member_id: memberId, register_id: rid, location_key: effKey });
          }
        } else if (linkKey) {
          linksNeedingReview++;
        }

        // Extra verrijking uit het register: logo, socials en telefoon
        const socials = (shop.socials ?? {}) as Record<string, string | null>;
        const shopLogo = typeof shop.logo_url === "string" && /^https?:\/\//i.test(shop.logo_url)
          ? shop.logo_url
          : null;

        if (!loc) {
          const candidate: any = {
            naam: shop.naam,
            plaats: shop.plaats ?? "",
            gemeente: shop.gemeente ?? "",
            adres: shopAddress(shop),
            postcode: shop.postcode ?? "",
          };
          // Een vestiging die het lid zelf heeft verwijderd komt nooit terug.
          if (isLocationDeleted(candidate, eff.verwijderd)) continue;
          // Laatste dubbelcheck: nooit een vestiging toevoegen die het lid al
          // heeft (bijv. met een afwijkende naam of ontbrekende postcode).
          if (locaties.some((l) => locationsMatch(l, candidate))) {
            linksNeedingReview++;
            continue;
          }
          // Alleen de startdatum van DEZE vestiging, nooit de bedrijfsdatum
          if (shop.kvk_vestiging_datum) candidate.oprichtingsDatum = shop.kvk_vestiging_datum;
          if (shop.kvk_nummer) candidate.kvk = shop.kvk_nummer;
          if (shop.vergunninghouder) candidate.vergunninghouder = shop.vergunninghouder;
          if (shop.exploitant) candidate.exploitant = shop.exploitant;
          if (shopLogo) candidate.logo = shopLogo;
          if (shop.telefoon) candidate.telefoon = shop.telefoon;
          if (socials.instagram) candidate.instagram = socials.instagram;
          if (socials.facebook) candidate.facebook = socials.facebook;
          baseData.locaties.push(candidate);
          locaties.push(candidate);
          locationsAdded++;
          baseChanged = true;
          continue;
        }

        // Eigendomsketen wordt bewust NIET bij het lid opgeslagen: die blijft
        // alleen in het register staan (uitsluitend leesbaar voor bestuur/beheer).
        if (loc.ubo) {
          const target = locationTarget(baseData, overlayData, loc);
          if (target?.layer === "overlay" && overlayData) {
            delete overlayData.locaties[target.index].ubo;
            overlayChanged = true;
          } else if (target?.layer === "base") {
            delete baseData.locaties[target.index].ubo;
            baseChanged = true;
          }
          delete loc.ubo;
        }

        const candidates: Array<[string, string | null]> = [
          "adres",
          "postcode",
          "plaats",
          "gemeente",
          "oprichtingsDatum",
          "kvk",
          "vergunninghouder",
          "exploitant",
          // De website hoort bij DEZE vestiging, niet bij het lid als geheel
          "website",
          "telefoon",
          "logo",
          "instagram",
          "facebook",
        ].map((field) => [field, registerValueFor(shop, field)] as [string, string | null]);

        for (const [field, value] of candidates) {
          if (!value) continue;
          if (isInvoiceField(field)) continue;
          const current = loc[field];
          if (!current || String(current).trim() === "") {
            if (fillLocationField(loc, field, value)) fieldsFilled++;
          } else if (!sameFieldValue(field, current, value)) {
            const key = `${memberId}|${rid}|${locKey}|${field}`;
            const linkScoped = `${memberId}|${rid}|${field}`;
            const prior = knownByLink.get(linkScoped);
            if (prior) {
              // Zelfde vestiging: bijwerken i.p.v. dupliceren.
              const patch: Record<string, unknown> = {};
              if ((prior.location_key ?? "") !== locKey) patch.location_key = locKey;
              if (prior.status === "open") {
                if (String(prior.proposed_value ?? "") !== String(value)) {
                  patch.proposed_value = String(value);
                }
                if (String(prior.current_value ?? "") !== String(current)) {
                  patch.current_value = String(current);
                }
              }
              if (prior.id && Object.keys(patch).length > 0) {
                proposalUpdates.push({ id: prior.id, patch });
                Object.assign(prior, patch);
              }
            } else if (!knownProposal.has(key)) {
              knownProposal.add(key);
              knownByLink.set(linkScoped, { location_key: locKey, field });

              proposals.push({
                member_id: memberId,
                register_id: rid,
                scope: "locatie",
                location_key: locKey,
                field,
                current_value: String(current),
                proposed_value: String(value),
                source:
                  field === "oprichtingsDatum"
                    ? "kvk-vestiging"
                    : field === "kvk"
                      ? "kvk"
                      : "register",
              });
            }
          }
        }

        // Lidniveau: alleen als het lid het veld nog helemaal niet heeft
        const memberCandidates: Array<[string, string | null]> = [
          ["telefoon", shop.telefoon],
        ];
        // Een registerwebsite hoort alleen bij het lid als er precies één
        // vestiging is; anders is het een vestigingslink en die wordt
        // uitsluitend op locatieniveau gezet/voorgesteld (zie candidates).
        if (locaties.length <= 1) {
          memberCandidates.push(["website", cleanWebsite(shop.website)]);
        }
        for (const [field, value] of memberCandidates) {
          if (!value) continue;
          if (isInvoiceField(field)) continue;
          const effectiveValue = eff.data[field];
          if (!effectiveValue || String(effectiveValue).trim() === "") {
            baseData[field] = value;
            eff.data[field] = value;
            fieldsFilled++;
            baseChanged = true;
          }
        }


        // De vergunninghoudende B.V. hoort bij DEZE vestiging (zie candidates:
        // vergunninghouder/exploitant/kvk op locatieniveau). Alleen als een lid
        // precies één vestiging heeft én nog geen factuurnaam kent, stellen we
        // die naam op lidniveau voor.
        if (locaties.length <= 1) {
          const factuurnaam = shop.vergunninghouder || shop.exploitant || null;
          const current = eff.data.bedrijfsnaam;
          if (factuurnaam && (!current || String(current).trim() === "")) {
            const key = `${memberId}|${rid}||bedrijfsnaam`;
            if (!knownProposal.has(key)) {
              knownProposal.add(key);
              proposals.push({
                member_id: memberId,
                register_id: rid,
                scope: "lid",
                location_key: null,
                field: "bedrijfsnaam",
                current_value: current ? String(current) : null,
                proposed_value: String(factuurnaam),
                source: "register",
              });
            }
          }
        }

      }

      // Openstaande voorstellen herberekenen tegen de actuele registerwaarde en
      // de effectieve ledenwaarde: alleen een echt inhoudelijk verschil blijft open.
      for (const p of openByMember.get(memberId) ?? []) {
        if (p.scope !== "locatie" || !p.register_id) continue;
        const shop = shopById.get(p.register_id);
        if (!shop) continue;
        const registerValue = registerValueFor(shop, p.field);
        const loc =
          findByLinkKey(locaties, p.location_key) ?? locaties.find((l) => sameLocation(l, shop));
        const currentValue = loc ? loc[p.field] : undefined;
        if (!registerValue) {
          proposalClosures.push({
            id: p.id,
            reden: "register heeft geen waarde meer voor dit veld",
          });
          continue;
        }
        if (
          currentValue &&
          String(currentValue).trim() !== "" &&
          sameFieldValue(p.field, currentValue, registerValue)
        ) {
          proposalClosures.push({
            id: p.id,
            reden: "ledengegevens komen al overeen met het register (geen wijziging nodig)",
          });
        }
      }

      if (baseChanged) {
        baseData.aantalLocaties = Array.isArray(baseData.locaties) ? baseData.locaties.length : 0;
        const { error: upErr } = await db
          .from("members_data")
          .update({ data: baseData })
          .eq("id", memberId);
        if (upErr) throw upErr;
      }
      if (overlayChanged && overlayData) {
        const { error: edErr } = await db
          .from("member_edits")
          .update({ data: overlayData })
          .eq("member_id", memberId);
        if (edErr) throw edErr;
      }
      if (baseChanged || overlayChanged) membersUpdated++;
    }

    // Verouderde locatiesleutels van bevestigde koppelingen bijwerken; de
    // koppeling zelf blijft aan dezelfde registershop hangen.
    let linksRelinked = 0;
    for (const fix of linkKeyFixes) {
      const { error } = await db
        .from("coffeeshop_member_links")
        .update({ location_key: fix.location_key })
        .eq("member_id", fix.member_id)
        .eq("register_id", fix.register_id);
      if (error) console.warn("locatiesleutel koppeling bijwerken mislukt:", error.message);
      else linksRelinked++;
    }

    // Verschoven/gewijzigde voorstellen bijwerken zodat de vestiging één groep blijft
    for (const upd of proposalUpdates) {
      const { error } = await db
        .from("register_enrichment_proposals")
        .update(upd.patch)
        .eq("id", upd.id);
      if (error) console.warn("voorstel bijwerken mislukt:", error.message);
    }

    // Voorstellen die geen verschil meer vormen, automatisch sluiten met reden
    let proposalsClosed = 0;
    for (const closure of proposalClosures) {
      const { error } = await db
        .from("register_enrichment_proposals")
        .update({
          status: "toegepast",
          resolved_at: new Date().toISOString(),
          resolutie_reden: `automatisch gesloten: ${closure.reden}`,
        })
        .eq("id", closure.id)
        .eq("status", "open");
      if (error) console.warn("voorstel sluiten mislukt:", error.message);
      else proposalsClosed++;
    }

    let proposalsSaved = 0;

    for (let i = 0; i < proposals.length; i += 200) {
      const chunk = proposals.slice(i, i + 200);
      const { error } = await db.from("register_enrichment_proposals").insert(chunk);
      if (error) console.warn("voorstellen opslaan mislukt:", error.message);
      else proposalsSaved += chunk.length;
    }

    return new Response(
      JSON.stringify({
        ok: true,
        membersUpdated,
        locationsAdded,
        fieldsFilled,
        proposals: proposalsSaved,
        proposalsClosed,
        linksRelinked,
        linksNeedingReview,
        kvkLookups,
        kvkEnabled: !!kvkKey,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("enrich-members-from-register mislukt:", err?.message ?? err);
    return new Response(JSON.stringify({ error: String(err?.message ?? err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
