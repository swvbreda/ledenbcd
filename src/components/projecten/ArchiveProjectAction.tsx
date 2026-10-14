import { useState } from "react";
import { Archive, ArchiveRestore, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/** Zet alleen archived_at (archiveren/terugzetten); nooit verwijderen of andere velden wijzigen. */
export async function setProjectArchived(db: any, id: string, archive: boolean, now: () => string = () => new Date().toISOString()) {
  const { data, error } = await db.from("internal_projects").update({ archived_at: archive ? now() : null }).eq("id", id).select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("Geen toegang");
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : (e as any)?.message ?? "Onbekende fout");

interface Props {
  title: string;
  archived: boolean;
  /** Bijv. tijdens bewerken, om onopgeslagen wijzigingen niet kwijt te raken. */
  disabled?: boolean;
  onSetArchived: (archive: boolean) => Promise<void>;
}

export function ArchiveProjectAction({ title, archived, disabled, onSetArchived }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (archive: boolean) => {
    setBusy(true); setError(null);
    try { await onSetArchived(archive); setOpen(false); }
    catch (e) { setError(errMsg(e)); }
    finally { setBusy(false); }
  };

  if (archived) {
    return (
      <div className="flex flex-col items-end gap-1">
        <Button variant="outline" className="min-h-10" disabled={disabled || busy} onClick={() => run(false)}>
          {busy ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <ArchiveRestore className="h-4 w-4 mr-1.5" />}Terugzetten
        </Button>
        {error && <p role="alert" className="text-xs text-destructive">Terugzetten mislukt: {error}</p>}
      </div>
    );
  }

  return (
    <>
      <Button variant="outline" className="min-h-10" disabled={disabled || busy} onClick={() => { setError(null); setOpen(true); }}>
        <Archive className="h-4 w-4 mr-1.5" />Verwijderen uit overzicht
      </Button>
      <AlertDialog open={open} onOpenChange={(o) => { if (!busy) setOpen(o); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>"{title}" verwijderen uit overzicht?</AlertDialogTitle>
            <AlertDialogDescription>
              Het project verdwijnt uit het actieve projectoverzicht en uit het ledenoverzicht. Geschiedenis, taken en documenten blijven bewaard.
              Je kunt het terugzetten via "Toon gearchiveerd".
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && <p role="alert" className="text-sm text-destructive">Verwijderen uit overzicht mislukt: {error}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Annuleren</AlertDialogCancel>
            <Button variant="destructive" disabled={busy} onClick={() => run(true)}>
              {busy && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}Verwijderen uit overzicht
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
