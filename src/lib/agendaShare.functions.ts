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
    };
  });
