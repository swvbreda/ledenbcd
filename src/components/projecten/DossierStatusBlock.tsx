import { useState } from "react";
import { Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fmtStatusDate } from "@/lib/statusDate";

const errMsg = (e: unknown) => (e instanceof Error ? e.message : (e as any)?.message ?? "Onbekende fout");

/** Handmatig geschreven algemene dossierstatus; nooit afgeleid uit projecten of taken. */
export function DossierStatusBlock({ name, summary, date, onSave }: {
  name: string; summary: string | null; date: string | null;
  onSave?: (summary: string, date: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [s, setS] = useState("");
  const [dt, setDt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const text = summary?.trim() || null;
  const f = fmtStatusDate(date);
  const save = async () => {
    setBusy(true); setError(null);
    try { await onSave!(s, dt); setOpen(false); }
    catch (e) { setError(errMsg(e)); }
    finally { setBusy(false); }
  };
  return (
    <div className="mx-4 mb-2 rounded-lg border border-border/70 bg-muted/30 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Algemene status</span>
        {f && <span className="text-xs text-muted-foreground tabular-nums">Stand per {f}</span>}
        <span className="flex-1" />
        {onSave && (
          <Button size="sm" variant="ghost" className="h-8 text-muted-foreground" aria-label={`Dossierstatus ${name} bewerken`}
            onClick={() => { setS(summary ?? ""); setDt(date ?? ""); setError(null); setOpen(true); }}>
            <Pencil className="h-3.5 w-3.5 mr-1.5" />Bewerken
          </Button>
        )}
      </div>
      {text
        ? <p className="mt-1 whitespace-pre-line break-words text-sm text-foreground">{text}</p>
        : <p className="mt-1 text-sm italic text-muted-foreground">Algemene status nog niet vastgelegd</p>}
      <Dialog open={open} onOpenChange={(o) => { if (!busy) setOpen(o); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dossierstatus bewerken</DialogTitle>
            <DialogDescription>{name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="ds-summary">Algemene status</Label>
              <Textarea id="ds-summary" rows={5} value={s} onChange={(e) => setS(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ds-date">Statusdatum</Label>
              <Input id="ds-date" type="date" value={dt} onChange={(e) => setDt(e.target.value)} />
            </div>
          </div>
          {error && <p role="alert" className="text-sm text-destructive">Opslaan mislukt: {error}</p>}
          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>Annuleren</Button>
            <Button disabled={busy} onClick={save}>{busy && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}Opslaan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
