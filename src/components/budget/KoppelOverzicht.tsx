import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CurrencyText } from "@/components/budget/CurrencyAmount";
import { useAdministratiePlan, useAdministratieBijwerken } from "@/hooks/useAdministratie";
import { useLedgerMutations } from "@/hooks/useLedger";
import { OUTCOME_LABEL, type MatchOutcome } from "@/lib/bankInvoiceMatch";

const EXCEPTIONS: MatchOutcome[] = ["ambiguous_invoice", "multi_invoice", "split_or_partial", "refund", "other_year", "invoice_already_paid_by_other", "duplicate_payment"];

export default function KoppelOverzicht({ year, isAdmin, memberNames }: { year: number; isAdmin: boolean; memberNames?: Map<number, string> }) {
  const plan = useAdministratiePlan(year, memberNames);
  const { syncYear } = useLedgerMutations(year);
  const bijwerken = useAdministratieBijwerken(year, () => syncYear.mutateAsync(), memberNames);

  if (plan.isLoading) return <div className="border border-border rounded-lg bg-card p-4 text-sm text-muted-foreground inline-flex items-center gap-2 w-full"><Loader2 size={14} className="animate-spin" /> Koppelingen laden…</div>;
  if (plan.error) return <div role="alert" className="border border-brand-red rounded-lg bg-card p-4 text-sm text-brand-red">Koppeloverzicht kon niet worden geladen: {(plan.error as any)?.message}. Dit is géén lege administratie.</div>;
  const p = plan.data!;
  const count = (o: MatchOutcome) => p.bank.filter((r) => r.outcome === o).length;
  const exceptions = p.bank.filter((r) => EXCEPTIONS.includes(r.outcome));
  const memberCount = (o: string) => p.members.filter((m) => m.outcome === o).length;
  const memberConflicts = p.members.filter((m) => m.outcome === "conflict" || m.outcome === "unmatched");

  return (
    <div className="border border-border rounded-lg bg-card p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Koppelingen boekjaar {year}</h3>
          <p className="text-xs text-muted-foreground">Informer is leidend. Bankmutaties zijn alleen betaalbewijs, nooit extra kosten. Betaalstatus komt uitsluitend uit Informer.</p>
        </div>
        {isAdmin && (
          <Button size="sm" disabled={bijwerken.isPending}
            onClick={() => bijwerken.mutate(undefined, {
              onSuccess: (r) => toast.success(`Bijgewerkt: ${r.bankLinked} bankkoppelingen, ${r.membersLinked} contributiefacturen gekoppeld, ${r.skipped} overgeslagen (bron of koppeling gewijzigd)`),
              onError: (e: any) => toast.error(e?.message ?? "Bijwerken mislukt"),
            })}>
            {bijwerken.isPending ? "Bezig…" : `Administratie ${year} bijwerken`}
          </Button>
        )}
      </div>
      {isAdmin && bijwerken.error && !bijwerken.isPending && (
        <div role="alert" className="border border-brand-red rounded-md p-2 text-sm text-brand-red inline-flex items-start gap-2 w-full">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>Bijwerken mislukt: {(bijwerken.error as any)?.message ?? String(bijwerken.error)}</span>
        </div>
      )}
      {isAdmin && bijwerken.data && !bijwerken.isPending && !bijwerken.error && (
        <div role="status" className="border border-border rounded-md p-2 text-sm">
          Laatste run: {bijwerken.data.bankLinked} bankkoppelingen, {bijwerken.data.membersLinked} contributiefacturen gekoppeld, {bijwerken.data.skipped} overgeslagen.
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 text-sm">
        <div><div className="text-xs text-muted-foreground">Bank al gekoppeld</div><div className="font-semibold tabular-nums">{count("linked_already")}</div></div>
        <div><div className="text-xs text-muted-foreground">Bank eenduidig te koppelen</div><div className="font-semibold tabular-nums">{count("match")}</div></div>
        <div><div className="text-xs text-muted-foreground">Bank uitzonderingen</div><div className="font-semibold tabular-nums">{exceptions.length}</div></div>
        <div><div className="text-xs text-muted-foreground">Bank zonder factuurnummer</div><div className="font-semibold tabular-nums">{count("no_reference")}</div></div>
        <div><div className="text-xs text-muted-foreground">Kosten zonder post</div><div className="font-semibold tabular-nums">{p.expensesWithoutPost}</div></div>
        <div><div className="text-xs text-muted-foreground">Kosten zonder dossier</div><div className="font-semibold tabular-nums">{p.expensesWithoutDossier}</div></div>
        <div><div className="text-xs text-muted-foreground">Contributiefacturen gekoppeld / voorstel / conflict</div><div className="font-semibold tabular-nums">{memberCount("linked")} / {memberCount("propose")} / {memberCount("conflict")}</div></div>
        <div><div className="text-xs text-muted-foreground">Dubbele bonnetjes (tellen niet)</div><div className="font-semibold tabular-nums">{p.duplicateReceipts}</div></div>
      </div>

      <p className="text-xs text-muted-foreground inline-flex items-start gap-1">
        <AlertTriangle size={12} className="mt-0.5 shrink-0" />
        Bronbeperking: de Informer-API geeft alleen de recentste verkoopfacturen; {p.snapshotSales} verkoopboekposten komen uit een vastgelegde Informer-bronsnapshot{p.snapshotAt ? ` van ${new Date(p.snapshotAt).toLocaleString("nl-NL")}` : ""} (worden niet automatisch bijgewerkt; een nieuwe stand vereist een nieuwe snapshot). Totaal {p.salesInList} verkoopdocumenten en per document alleen bij een bekend Informer-nummer. {p.contributionsWithNumber} contributies hebben een factuurnummer; facturen (zoals januari) waarvan het Informer-nummer onbekend is, blijven ontbrekend tot ze in Informer zichtbaar zijn. Bankjournaalposten/aflettering levert de Informer-API niet.
      </p>

      {exceptions.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer font-medium">Bankuitzonderingen ({exceptions.length}) — handmatig beoordelen</summary>
          <ul className="mt-2 space-y-1">
            {exceptions.map((r) => (
              <li key={r.tx.id} className="flex flex-wrap gap-2">
                <span className="tabular-nums">{String(r.tx.executed_at ?? "").slice(0, 10)}</span>
                <CurrencyText value={r.tx.amount} />
                <span className="text-muted-foreground">{OUTCOME_LABEL[r.outcome]}</span>
                <span className="text-muted-foreground">{r.candidates.map((c) => `${c.doc_type === "sales_invoice" ? "verkoop" : c.doc_type === "receipt" ? "bon" : "inkoop"} ${c.informer_id}`).join(", ")}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
      {memberConflicts.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer font-medium">Contributiefacturen niet automatisch gekoppeld ({memberConflicts.length})</summary>
          <ul className="mt-2 space-y-1">
            {memberConflicts.map((m) => (
              <li key={m.entry.informer_id}>Document {m.entry.informer_id} ({m.entry.invoice_number ?? "geen nummer"}, <CurrencyText value={m.entry.amount_incl} />): {m.reason}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
