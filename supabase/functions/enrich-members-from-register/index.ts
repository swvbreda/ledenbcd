import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

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

  try {
    const { data: links, error: linkErr } = await db
      .from("coffeeshop_member_links")
      .select("register_id, member_id, status")
      .eq("status", "bevestigd");
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
      .select("member_id, register_id, location_key, field, status");
    const knownProposal = new Set(
      (existingProposals ?? []).map(
        (p: any) => `${p.member_id}|${p.register_id ?? ""}|${p.location_key ?? ""}|${p.field}`,
      ),
    );

    const byMember = new Map<number, string[]>();
    for (const l of links ?? []) {
      const arr = byMember.get(l.member_id) ?? [];
      arr.push(l.register_id);
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

      const data: any = JSON.parse(JSON.stringify(row.data ?? {}));
      const locaties: any[] = Array.isArray(data.locaties) ? data.locaties : [];
      let changed = false;

      for (const rid of shopIds) {
        const shop = shopById.get(rid);
        if (!shop || shop.vervallen) continue;

        let loc = locaties.find((l) => sameLocation(l, shop));
        // De sleutel verwijst naar de bestaande ledenlocatie. Gebruik daarom de
        // huidige postcode van die locatie, niet de mogelijk gewijzigde registerpostcode.
        const locKey = loc ? normPc(loc.postcode) || norm(loc.naam) : normPc(shop.postcode) || norm(shop.naam);

        const ubo = uboByRegister.get(rid) ?? [];

        if (!loc) {
          loc = {
            naam: shop.naam,
            plaats: shop.plaats ?? "",
            stadsdeel: shop.gemeente ?? "",
            adres: shopAddress(shop),
            postcode: shop.postcode ?? "",
          };
          // Alleen de startdatum van DEZE vestiging, nooit de bedrijfsdatum
          if (shop.kvk_vestiging_datum) loc.oprichtingsDatum = shop.kvk_vestiging_datum;
          if (shop.kvk_nummer) loc.kvk = shop.kvk_nummer;
          if (shop.vergunninghouder) loc.vergunninghouder = shop.vergunninghouder;
          if (shop.exploitant) loc.exploitant = shop.exploitant;
          if (ubo.length) loc.ubo = ubo;
          locaties.push(loc);
          locationsAdded++;
          changed = true;
          continue;
        }

        // Eigendomsketen altijd bijwerken vanuit de bron (register is leidend)
        if (ubo.length && JSON.stringify(loc.ubo ?? []) !== JSON.stringify(ubo)) {
          loc.ubo = ubo;
          fieldsFilled++;
          changed = true;
        }

        const candidates: Array<[string, string | null]> = [
          ["adres", shopAddress(shop) || null],
          ["postcode", shop.postcode],
          ["plaats", shop.plaats],
          ["stadsdeel", shop.gemeente],
          ["oprichtingsDatum", shop.kvk_vestiging_datum],
          ["kvk", shop.kvk_nummer],
          ["vergunninghouder", shop.vergunninghouder],
          ["exploitant", shop.exploitant],
          // De website hoort bij DEZE vestiging, niet bij het lid als geheel
          ["website", cleanWebsite(shop.website)],
        ];


        for (const [field, value] of candidates) {
          if (!value) continue;
          if (isInvoiceField(field)) continue;
          const current = loc[field];
          if (!current || String(current).trim() === "") {
            loc[field] = value;
            fieldsFilled++;
            changed = true;
          } else if (norm(current) !== norm(value)) {
            const key = `${memberId}|${rid}|${locKey}|${field}`;
            if (!knownProposal.has(key)) {
              knownProposal.add(key);
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
          if (!data[field] || String(data[field]).trim() === "") {
            data[field] = value;
            fieldsFilled++;
            changed = true;
          }
        }


        // Facturatiegevoelig: nooit stil invullen, altijd als voorstel
        const sensitive: Array<[string, string | null]> = [
          ["bedrijfsnaam", shop.vergunninghouder || shop.exploitant || null],
          ["kvk", shop.kvk_nummer],
        ];
        for (const [field, value] of sensitive) {
          if (!value) continue;
          const current = data[field];
          if (current && norm(current) === norm(value)) continue;
          const key = `${memberId}|${rid}||${field}`;
          if (knownProposal.has(key)) continue;
          knownProposal.add(key);
          proposals.push({
            member_id: memberId,
            register_id: rid,
            scope: "lid",
            location_key: null,
            field,
            current_value: current ? String(current) : null,
            proposed_value: String(value),
            source: field === "kvk" ? "kvk" : "register",
          });
        }
      }

      if (changed) {
        data.locaties = locaties;
        data.aantalLocaties = locaties.length;
        const { error: upErr } = await db
          .from("members_data")
          .update({ data })
          .eq("id", memberId);
        if (upErr) throw upErr;
        membersUpdated++;
      }
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
