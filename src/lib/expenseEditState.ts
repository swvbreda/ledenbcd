// Pure helper voor de state-overgang na het opslaan van een ledger-override.
// Succes sluit de bewerkmodus altijd; een fout laat de bewerkmodus open staan.

export type LedgerSaveOutcome =
  | { ok: true }
  | { ok: false; message?: string | null };

export interface LedgerSaveTransition {
  /** Blijft de bewerkmodus open? */
  keepEditing: boolean;
  /** Bewerkvelden resetten (alleen na succes). */
  reset: boolean;
  /** Foutmelding voor de gebruiker, of null. */
  saveError: string | null;
  /** Opslaan is klaar; dubbelklikbescherming vervalt. */
  saving: false;
}

export function ledgerSaveTransition(outcome: LedgerSaveOutcome): LedgerSaveTransition {
  if (outcome.ok) {
    return { keepEditing: false, reset: true, saveError: null, saving: false };
  }
  return {
    keepEditing: true,
    reset: false,
    saveError: outcome.message?.trim() || "Opslaan mislukt",
    saving: false,
  };
}
