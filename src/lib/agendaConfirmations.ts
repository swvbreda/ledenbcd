/**
 * Gedeelde bevestigingspoort voor agenda-aanmeldingen.
 *
 * Kern: per bijeenkomst en per genormaliseerd e-mailadres mag er hooguit één
 * bevestiging de deur uit — ongeacht of die via e-mail of via de Outlook-agenda
 * loopt. De claim gebeurt atomair in de database; een claim wordt nooit
 * teruggedraaid, ook niet na een fout of time-out, omdat dan onbekend is of de
 * ontvanger al iets gekregen heeft. Zulke gevallen krijgen de status
 * `uncertain` en worden nooit automatisch opnieuw geprobeerd.
 */

export type ConfirmationChannel = "email" | "outlook";

export interface DispatchSettings {
  /** Globale noodpauze: staat alles naar Outlook stil. */
  dispatchEnabled: boolean;
  /** Mogen aanmeldingen de agenda-koppeling aanroepen? */
  registrationSyncEnabled: boolean;
  /** Het enige kanaal dat een aanmeldbevestiging mag versturen. */
  confirmationChannel: ConfirmationChannel;
}

/** Minimale vorm van de service-role client; houdt tests mockbaar. */
export interface ConfirmationDb {
  from: (table: string) => {
    select: (cols: string) => {
      maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
    };
  };
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
}

export class DispatchPausedError extends Error {
  constructor(public readonly reason: string) {
    super(reason);
    this.name = "DispatchPausedError";
  }
}

/**
 * Leest de schakelaars. Fail closed: bij een databasefout of een ontbrekende
 * instellingenregel gaan we ervan uit dat alles gepauzeerd is.
 */
export async function loadDispatchSettings(db: ConfirmationDb): Promise<DispatchSettings> {
  const { data, error } = await db
    .from("agenda_outlook_settings")
    .select("registration_sync_enabled, outlook_dispatch_enabled, confirmation_channel")
    .maybeSingle();

  if (error) throw new DispatchPausedError("settings_unavailable");
  if (!data) throw new DispatchPausedError("settings_missing");

  const row = data as {
    registration_sync_enabled?: boolean | null;
    outlook_dispatch_enabled?: boolean | null;
    confirmation_channel?: string | null;
  };

  const channel = (row.confirmation_channel ?? "").trim().toLowerCase();
  return {
    dispatchEnabled: row.outlook_dispatch_enabled === true,
    registrationSyncEnabled: row.registration_sync_enabled === true,
    confirmationChannel: channel === "outlook" ? "outlook" : "email",
  };
}

/**
 * Reserveert adressen die nog nooit een bevestiging kregen. Geeft uitsluitend
 * de adressen terug die deze aanroep gewonnen heeft; parallelle aanroepen
 * krijgen er hooguit samen één.
 */
export async function claimConfirmations(
  db: ConfirmationDb,
  args: { eventId: string; channel: ConfirmationChannel; emails: string[]; source: string },
): Promise<string[]> {
  const emails = [...new Set(args.emails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
  if (emails.length === 0) return [];

  const { data, error } = await db.rpc("agenda_claim_confirmations", {
    _event_id: args.eventId,
    _channel: args.channel,
    _emails: emails,
    _source: args.source,
  });
  if (error) throw error;

  return ((data ?? []) as ({ email: string } | string)[]).map((row) =>
    typeof row === "string" ? row : row.email,
  );
}

/**
 * Legt de uitkomst vast. `sent` = zeker afgeleverd, `uncertain` = de aflevering
 * kan gebeurd zijn. Beide blokkeren een volgende poging; er wordt nooit een
 * claim verwijderd.
 */
export async function markConfirmations(
  db: ConfirmationDb,
  args: { eventId: string; emails: string[]; status: "sent" | "uncertain"; note?: string },
): Promise<void> {
  if (args.emails.length === 0) return;
  const { error } = await db.rpc("agenda_mark_confirmations", {
    _event_id: args.eventId,
    _emails: args.emails,
    _status: args.status,
    _note: args.note ?? null,
  });
  if (error) {
    // Bewust niet doorwerpen: de claim staat al vast, dus dubbele verzending
    // blijft onmogelijk. Alleen de status blijft dan op 'attempted' staan.
    console.error("agenda_mark_confirmations mislukt", error);
  }
}
