import { useState } from "react";
import { FilePlus2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

interface Candidate {
  member_id: number;
  naam: string;
  year: number;
  start_month: number;
  months: number;
  amount: number;
  status: "gepland" | "aangemaakt" | "mislukt";
  error?: string;
}

const euro = (n: number) => `€ ${n.toLocaleString("nl-NL")}`;

async function callPrepare(dryRun: boolean) {
  const { data, error } = await supabase.functions.invoke(
    `informer-sync?action=prepare_invoices${dryRun ? "&dry_run=1" : ""}`,
    { body: {} },
  );
  if (error) throw new Error(error.message);
  const result = (data as any)?.results?.[0];
  if (!result) throw new Error("Geen antwoord van de boekhoudkoppeling");
  return result as { success: boolean; error_message?: string; details?: { candidates?: Candidate[] } };
}

export default function PrepareInvoicesDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [done, setDone] = useState(false);

  const openPreview = async () => {
    setLoading(true);
    setDone(false);
    try {
      const result = await callPrepare(true);
      setCandidates(result.details?.candidates ?? []);
      setOpen(true);
    } catch (e) {
      toast.error((e as Error).message || "Kon het overzicht niet ophalen");
    } finally {
      setLoading(false);
    }
  };

  const run = async () => {
    setRunning(true);
    try {
      const result = await callPrepare(false);
      const list = result.details?.candidates ?? [];
      setCandidates(list);
      setDone(true);
      const created = list.filter((c) => c.status === "aangemaakt").length;
      const failed = list.filter((c) => c.status === "mislukt").length;
      if (created > 0) toast.success(`${created} factuur/facturen klaargezet in de boekhouding`);
      if (failed > 0) toast.error(`${failed} lid/leden konden niet worden verwerkt`);
      queryClient.invalidateQueries({ queryKey: ["contributions"] });
      queryClient.invalidateQueries({ queryKey: ["contribution-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["finance-todos"] });
    } catch (e) {
      toast.error((e as Error).message || "Klaarzetten mislukt");
    } finally {
      setRunning(false);
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" className="gap-1.5 h-8" onClick={openPreview} disabled={loading}>
        <FilePlus2 size={12} /> {loading ? "Bezig..." : "Ontbrekende facturen klaarzetten"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Ontbrekende contributiefacturen</DialogTitle>
            <DialogDescription>
              Voor deze leden staat dit jaar nog geen factuur klaar. Het bedrag is naar rato van
              de resterende maanden. De facturen worden als concept klaargezet en niet verstuurd.
            </DialogDescription>
          </DialogHeader>

          {candidates.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              Alle leden hebben al een factuur voor dit jaar.
            </p>
          ) : (
            <div className="max-h-72 overflow-y-auto divide-y divide-border rounded-md border border-border">
              {candidates.map((c) => (
                <div key={c.member_id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      <span className="text-muted-foreground mr-1">#{c.member_id}</span>
                      {c.naam}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {c.months}/12 maanden
                      {c.status === "mislukt" && c.error ? ` — ${c.error}` : ""}
                      {c.status === "aangemaakt" ? " — klaargezet" : ""}
                    </p>
                  </div>
                  <span className="tabular-nums whitespace-nowrap">{euro(c.amount)}</span>
                </div>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {done ? "Sluiten" : "Annuleren"}
            </Button>
            {!done && candidates.length > 0 && (
              <Button onClick={run} disabled={running}>
                {running ? "Bezig..." : `Klaarzetten (${candidates.length})`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
