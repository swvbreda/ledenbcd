import { useState } from "react";
import { EyeOff, ArchiveRestore, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const errMsg = (e: unknown) => (e instanceof Error ? e.message : (e as any)?.message ?? "Onbekende fout");

/** Verwijdert een dossierkop alleen uit het Projecten-overzicht (omkeerbaar). */
export function DossierHideAction({ name, hidden, onSetHidden }: {
  name: string; hidden: boolean; onSetHidden: (hide: boolean) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (hide: boolean) => {
    setBusy(true); setError(null);
    try { await onSetHidden(hide); setOpen(false); }
    catch (e) { setError(errMsg(e)); }
    finally { setBusy(false); }
  };
  if (hidden) {
    return (
      <span className="flex flex-col items-end gap-1">
        <Button size="sm" variant="outline" className="min-h-9" disabled={busy} onClick={() => run(false)}>
          {busy ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <ArchiveRestore className="h-4 w-4 mr-1.5" />}Terugzetten
        </Button>
        {error && <span role="alert" className="text-xs text-destructive">Terugzetten mislukt: {error}</span>}
      </span>
    );
  }
  return (
    <>
      <Button size="sm" variant="ghost" className="min-h-9 text-muted-foreground" aria-label={`Dossier ${name} verwijderen uit projectoverzicht`}
        onClick={() => { setError(null); setOpen(true); }}>
        <EyeOff className="h-4 w-4 mr-1.5" />Verwijderen
      </Button>
      <AlertDialog open={open} onOpenChange={(o) => { if (!busy) setOpen(o); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dossier "{name}" verwijderen uit dit projectoverzicht?</AlertDialogTitle>
            <AlertDialogDescription>
              Het dossier verdwijnt alleen uit het dossieroverzicht bij Projecten (met eventuele subdossiers). Gekoppelde projecten en hun geschiedenis blijven bewaard
              en staan voortaan onder "Overige projecten". Jaarplan en Financiën veranderen niet. Terugzetten kan via "Toon verwijderde dossiers".
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && <p role="alert" className="text-sm text-destructive">Verwijderen mislukt: {error}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Annuleren</AlertDialogCancel>
            <Button variant="destructive" disabled={busy} onClick={() => run(true)}>
              {busy && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}Verwijderen
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
