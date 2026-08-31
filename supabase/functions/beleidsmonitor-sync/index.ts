import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * Koppeling met de Beleidsmonitor (project "Coffeeshopbeleid").
 *
 * 1. Duwt de ledenlijst (leden + leads met vestigingen) in batches van 5.000
 *    naar /api/public/hooks/leden-sync met header `x-bcd-sleutel`.
 * 2. Haalt de verrijkte dossiers op via /api/public/leden-dossier en slaat ze
 *    lokaal op in `beleidsmonitor_dossiers`.
 *
 * Draait dagelijks via pg_cron en kan handmatig gestart worden door een admin.
 */

const BASE_URL = Deno.env.get("BELEIDSMONITOR_BASE_URL") ?? "https://coffeeshopbeleid.lovable.app";
const BATCH_SIZE = 5000;

function admin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/** Basisgegevens en goedgekeurde wijzigingen samenvoegen. */
function mergeMember(base: any, overlay: any) {
  const data = { ...(base ?? {}), ...(overlay ?? {}) };
  const locBase = Array.isArray(base?.locaties) ? base.locaties : [];
  const locOverlay = Array.isArray(overlay?.locaties) ? overlay.locaties : [];
  data.locaties = locOverlay.length >= locBase.length ? locOverlay : locBase;
  return data;
}

function buildPayload(rows: any[], edits: Map<number, any>) {
  return rows.map((row) => {
    const data = mergeMember(row.data, edits.get(row.id));
    const locaties = (Array.isArray(data.locaties) ? data.locaties : []).map((l: any) => ({
      naam: l?.naam ?? null,
      adres: l?.adres ?? null,
      postcode: l?.postcode ?? null,
      plaats: l?.plaats ?? null,
      kvk: l?.kvk ?? null,
    }));
    return {
      lid_id: row.id,
      type: row.member_type,
      naam: data.naam ?? data.bedrijfsnaam ?? null,
      bedrijfsnaam: data.bedrijfsnaam ?? null,
      plaats: data.plaats ?? null,
      kvk: data.kvk ?? null,
      lid_sinds: data.lidSinds ?? null,
      aantal_locaties: locaties.length || Number(data.aantalLocaties ?? 1),
      locaties,
    };
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const internal = Deno.env.get("INTERNAL_WEBHOOK_SECRET");
  const providedInternal = req.headers.get("x-internal-secret");
  const isService = (req.headers.get("authorization") ?? "") ===
    `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`;
  if (!isService && (!internal || providedInternal !== internal)) {
    return json({ error: "Unauthorized" }, 401);
  }

  const sleutel = Deno.env.get("BCD_KOPPEL_SLEUTEL");
  if (!sleutel) return json({ error: "BCD_KOPPEL_SLEUTEL ontbreekt" }, 500);

  const db = admin();
  let pushed = 0;
  let pulled = 0;

  try {
    // 1. Ledenlijst samenstellen
    const [{ data: members, error: memberError }, { data: editRows }] = await Promise.all([
      db.from("members_data").select("id, member_type, data").in("member_type", ["member", "lead"]),
      db.from("member_edits").select("member_id, data"),
    ]);
    if (memberError) throw memberError;

    const edits = new Map<number, any>((editRows ?? []).map((e: any) => [e.member_id, e.data]));
    const payload = buildPayload(members ?? [], edits);

    // 2. Pushen in batches van 5.000
    for (let i = 0; i < payload.length; i += BATCH_SIZE) {
      const batch = payload.slice(i, i + BATCH_SIZE);
      const res = await fetch(`${BASE_URL}/api/public/hooks/leden-sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-bcd-sleutel": sleutel },
        body: JSON.stringify({
          batch: Math.floor(i / BATCH_SIZE) + 1,
          batches: Math.ceil(payload.length / BATCH_SIZE),
          totaal: payload.length,
          leden: batch,
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`leden-sync gaf ${res.status}: ${body.slice(0, 300)}`);
      }
      pushed += batch.length;
    }

    // 3. Verrijkte dossiers ophalen
    const dossierRes = await fetch(`${BASE_URL}/api/public/leden-dossier`, {
      headers: { "x-bcd-sleutel": sleutel },
    });
    if (dossierRes.ok) {
      const body = await dossierRes.json();
      const dossiers: any[] = body.leden ?? body.data ?? [];
      const rows = dossiers.map((d) => ({
        member_id: Number.isFinite(Number(d.lid_id)) ? Number(d.lid_id) : null,
        extern_id: d.id ? String(d.id) : null,
        naam: d.naam ?? null,
        gemeente: d.gemeente ?? d.plaats ?? null,
        data: d,
        fetched_at: new Date().toISOString(),
      }));
      for (let i = 0; i < rows.length; i += 500) {
        const chunk = rows.slice(i, i + 500);
        const { error } = await db
          .from("beleidsmonitor_dossiers")
          .upsert(chunk, { onConflict: "extern_id" , ignoreDuplicates: false });
        if (error) {
          // Val terug op losse inserts wanneer de bron geen extern id levert
          for (const row of chunk) {
            await db.from("beleidsmonitor_dossiers").upsert(row);
          }
        }
        pulled += chunk.length;
      }
    } else if (dossierRes.status !== 404) {
      const body = await dossierRes.text();
      throw new Error(`leden-dossier gaf ${dossierRes.status}: ${body.slice(0, 300)}`);
    }

    await db.from("beleidsmonitor_sync_state").upsert({
      id: 1,
      last_push_at: new Date().toISOString(),
      last_push_count: pushed,
      last_pull_at: new Date().toISOString(),
      last_pull_count: pulled,
      last_status: "ok",
      last_error: null,
      updated_at: new Date().toISOString(),
    });

    return json({ success: true, pushed, pulled });
  } catch (error) {
    const message = String((error as Error).message ?? error);
    console.error("beleidsmonitor-sync error:", message);
    await db.from("beleidsmonitor_sync_state").upsert({
      id: 1,
      last_status: "error",
      last_error: message.slice(0, 500),
      updated_at: new Date().toISOString(),
    });
    return json({ error: message }, 500);
  }
});
