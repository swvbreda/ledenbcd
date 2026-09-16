import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export interface AgendaSharePreview {
  id: string;
  title: string;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  event_type: string | null;
  image_path: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
}

/**
 * Publieke, alleen-lezen preview van een agendapunt op basis van de korte
 * deelcode. Geeft uitsluitend titel, datum, tijd en locatie terug.
 */
export const getAgendaSharePreview = createServerFn({ method: "GET" })
  .inputValidator((data: { code: string }) => ({
    code: (data?.code ?? "").replace(/[^A-Za-z0-9]/g, "").slice(0, 12).toUpperCase(),
  }))
  .handler(async ({ data }): Promise<AgendaSharePreview | null> => {
    if (!data.code) return null;

    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const url = process.env["SUPABASE_URL"]!;
    const supabase = createClient<Database>(url, key, {
      auth: { persistSession: false },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
            h.delete("Authorization");
          }
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });

    const { data: rows, error } = await supabase.rpc("get_agenda_share", { _code: data.code });
    if (error) return null;
    const ev = Array.isArray(rows) ? rows[0] : null;
    if (!ev) return null;
    return {
      id: ev.id,
      title: ev.title,
      event_date: ev.event_date,
      start_time: ev.start_time ?? null,
      end_time: ev.end_time ?? null,
      location: ev.location ?? null,
      event_type: ev.event_type ?? null,
      image_path: (ev as { image_path?: string | null }).image_path ?? null,
      cancelled_at: (ev as { cancelled_at?: string | null }).cancelled_at ?? null,
      cancel_reason: (ev as { cancel_reason?: string | null }).cancel_reason ?? null,
    };
  });

export interface GuestSignupResult {
  ok: boolean;
  message: string;
}

/**
 * Aanmelding van een niet-lid via de publieke deellink. Validatie gebeurt op
 * basis van de deelcode: alleen een bestaand, niet-geannuleerd en toekomstig
 * agendapunt accepteert aanmeldingen. Wegschrijven gaat met de serverclient,
 * zodat anonieme bezoekers geen directe tabeltoegang nodig hebben.
 */
export const registerAgendaGuest = createServerFn({ method: "POST" })
  .inputValidator((data: {
    code: string;
    naam: string;
    email: string;
    organisatie?: string;
    telefoon?: string;
    guests?: number;
    note?: string;
  }) => ({
    code: (data?.code ?? "").replace(/[^A-Za-z0-9]/g, "").slice(0, 12).toUpperCase(),
    naam: (data?.naam ?? "").trim().slice(0, 120),
    email: (data?.email ?? "").trim().toLowerCase().slice(0, 160),
    organisatie: (data?.organisatie ?? "").trim().slice(0, 160),
    telefoon: (data?.telefoon ?? "").trim().slice(0, 40),
    guests: Math.min(Math.max(Number(data?.guests ?? 1) || 1, 1), 20),
    note: (data?.note ?? "").trim().slice(0, 500),
  }))
  .handler(async ({ data }): Promise<GuestSignupResult> => {
    if (!data.code) return { ok: false, message: "Deze uitnodiging is niet geldig." };
    if (data.naam.length < 2) return { ok: false, message: "Vul je naam in." };
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email)) {
      return { ok: false, message: "Vul een geldig e-mailadres in." };
    }

    const preview = await getAgendaSharePreview({ data: { code: data.code } });
    if (!preview) return { ok: false, message: "Deze uitnodiging is niet (meer) beschikbaar." };
    if (preview.cancelled_at) return { ok: false, message: "Dit evenement is geannuleerd." };
    const vandaag = new Date().toISOString().slice(0, 10);
    if (preview.event_date < vandaag) {
      return { ok: false, message: "Dit evenement is al geweest." };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("agenda_guest_registrations")
      .upsert(
        {
          event_id: preview.id,
          naam: data.naam,
          email: data.email,
          organisatie: data.organisatie || null,
          telefoon: data.telefoon || null,
          guests: data.guests,
          note: data.note || null,
        },
        { onConflict: "event_id,email" },
      );

    if (error) {
      // Dubbele aanmelding op hetzelfde e-mailadres is geen fout voor de bezoeker.
      if (error.code === "23505") {
        return { ok: true, message: "Je was al aangemeld. We hebben je gegevens bijgewerkt." };
      }
      console.error("registerAgendaGuest", error);
      return { ok: false, message: "Aanmelden lukte niet. Probeer het later opnieuw." };
    }

    return { ok: true, message: "Je aanmelding is ontvangen. Je hoort van ons." };
  });
