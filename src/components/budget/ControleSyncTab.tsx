import { useState } from "react";
import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyText } from "@/components/budget/CurrencyAmount";
import {
  useLedgerTotals,
  useLedgerMutations,
  useUnlinkedBankTransactions,
  useUnmatchedSalesInvoices,
  useInformerSyncState,
} from "@/hooks/useLedger";
import { formatDistanceToNow } from "date-fns";
import { nl } from "date-fns/locale";
import { toast } from "sonner";

interface Props {
  year: number;
}

function StatCard({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="border border-border rounded-lg bg-card p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}

export default function ControleSyncTab({ year }: Props) {
  const totals = useLedgerTotals(year);
  const { data: unlinked } = useUnlinkedBankTransactions(year);
  const { data: unmatched } = useUnmatchedSalesInvoices(year);
  const { data: syncState } = useInformerSyncState();
  const { syncYear } = useLedgerMutations(year);

  // Referentiewaarden uit de boekhouding; leeg laten = geen vergelijking.
  const [refExpenses, setRefExpenses] = useState("");
  const [refRevenue, setRefRevenue] = useState("");

  const lastSync = syncState?.state?.last_invoice_sync_at ?? null;
  const lastLog = (syncState?.log ?? []).find((l: any) => l.action === "sync_year");

  const compare = (reference: string, actual: number) => {
    const parsed = Number(reference.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
    if (!reference.trim() || !Number.isFinite(parsed)) return null;
    return Math.abs(parsed - actual) < 0.51;
  };

  const expensesOk = compare(refExpenses, totals.totalExpenses);
  const revenueOk = compare(refRevenue, totals.totalRevenue);

  return (
    <div className="space-y-4">
      <div className="border border-border rounded-lg bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <h3 className="text-sm font-semibold">Synchronisatie boekjaar {year}</h3>
            <p className="text-xs text-muted-foreground">
              {lastSync
                ? `Laatste volledige jaarsync ${formatDistanceToNow(new Date(lastSync), { addSuffix: true, locale: nl })}`
                : "Nog geen volledige jaarsync uitgevoerd"}
              {lastLog?.error_message ? ` — laatste fout: ${lastLog.error_message}` : ""}
            </p>
          </div>
          <Button
            onClick={() =>
              syncYear.mutate(undefined, {
                onSuccess: () => toast.success(`Boekjaar ${year} opnieuw opgehaald uit de boekhouding`),
                onError: (e: any) => toast.error(e?.message ?? "Synchroniseren mislukt"),
              })
            }
            disabled={syncYear.isPending}
          >
            <RefreshCw size={16} className={syncYear.isPending ? "animate-spin" : ""} />
            Volledig jaar ophalen
          </Button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Uitgaven" value={<CurrencyText value={totals.totalExpenses} />} hint="inkoopfacturen" />
          <StatCard label="Opbrengsten" value={<CurrencyText value={totals.totalRevenue} />} hint="verkoopfacturen" />
          <StatCard label="Resultaat" value={<CurrencyText value={totals.netResult} />} />
          <StatCard label="Openstaand verkoop" value={<CurrencyText value={totals.openSales} />} />
        </div>

        <div className="mt-3 flex items-start gap-2 text-xs rounded-md border border-border p-2">
          {totals.readiness.reconciled ? (
            <CheckCircle2 size={14} className="text-emerald-600 mt-0.5" />
          ) : (
            <AlertTriangle size={14} className="text-amber-600 mt-0.5" />
          )}
          <div>
            <div className="font-medium">
              {totals.readiness.reconciled
                ? "Gereconcilieerd met de boekhouding"
                : "Niet volledig gereconcilieerd"}
            </div>
            <div className="text-muted-foreground">
              {totals.readiness.reasons.length > 0
                ? totals.readiness.reasons.join(" ")
                : "Vul hieronder de controletotalen in om dit te bevestigen."}
              {" "}
              {totals.readiness.counted} meetellende regels, {totals.readiness.attention} aandachtspunten,{" "}
              {totals.readiness.withoutLedgerAccount} zonder kostenrubriek.
            </div>
          </div>
        </div>
      </div>

      <div className="border border-border rounded-lg bg-card p-4">
        <h3 className="text-sm font-semibold mb-2">Controletotalen vergelijken</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Vul de totalen in die de boekhouding toont. Zonder invoer tonen we geen oordeel.
        </p>
        <p className="text-xs text-muted-foreground mb-3">
          Let op: de koppeling met de boekhouding levert alleen verkoop- en inkoopfacturen,
          geen grootboekmutaties. Wijken de totalen daardoor af, dan tonen we dat als
          &quot;niet gereconcilieerd&quot; en vullen we niets aan met een schatting.
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Uitgaven volgens boekhouding</label>
            <Input value={refExpenses} onChange={(e) => setRefExpenses(e.target.value)} placeholder="bijv. 275.797,00" />
            <div className="text-xs mt-1">
              {expensesOk === null ? (
                <span className="text-muted-foreground">niet gereconcilieerd</span>
              ) : expensesOk ? (
                <span className="text-emerald-600 inline-flex items-center gap-1"><CheckCircle2 size={12} /> klopt</span>
              ) : (
                <span className="text-brand-red inline-flex items-center gap-1"><AlertTriangle size={12} /> wijkt af</span>
              )}
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Opbrengsten volgens boekhouding</label>
            <Input value={refRevenue} onChange={(e) => setRefRevenue(e.target.value)} placeholder="bijv. 349.574,79" />
            <div className="text-xs mt-1">
              {revenueOk === null ? (
                <span className="text-muted-foreground">niet gereconcilieerd</span>
              ) : revenueOk ? (
                <span className="text-emerald-600 inline-flex items-center gap-1"><CheckCircle2 size={12} /> klopt</span>
              ) : (
                <span className="text-brand-red inline-flex items-center gap-1"><AlertTriangle size={12} /> wijkt af</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="border border-border rounded-lg bg-card p-4">
        <h3 className="text-sm font-semibold mb-2">
          Aandachtspunten in de boekhouding ({totals.attention.length})
        </h3>
        <p className="text-xs text-muted-foreground mb-2">
          Concepten, nog te verwerken documenten, geannuleerde en €0-facturen. Deze tellen niet mee in de bedragen.
        </p>
        {totals.attention.length === 0 ? (
          <p className="text-sm text-muted-foreground">Geen openstaande aandachtspunten.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {totals.attention.slice(0, 50).map((e) => (
                <tr key={`${e.doc_type}-${e.informer_id}`} className="border-b border-border/40 last:border-0">
                  <td className="py-1.5">{e.entry_date ?? "—"}</td>
                  <td className="py-1.5">{e.relation_name ?? e.description ?? e.invoice_number ?? "—"}</td>
                  <td className="py-1.5 text-muted-foreground">{e.status_raw || e.status}</td>
                  <td className="py-1.5 text-right tabular-nums"><CurrencyText value={e.amount_incl} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="border border-border rounded-lg bg-card p-4">
          <h3 className="text-sm font-semibold mb-2">
            Bankmutaties zonder factuurkoppeling ({unlinked?.length ?? 0})
          </h3>
          <p className="text-xs text-muted-foreground mb-2">Werklijst voor aflettering; tellen nergens financieel mee.</p>
          <table className="w-full text-sm">
            <tbody>
              {(unlinked ?? []).slice(0, 25).map((t: any) => (
                <tr key={t.id} className="border-b border-border/40 last:border-0">
                  <td className="py-1.5">{String(t.executed_at ?? "").slice(0, 10)}</td>
                  <td className="py-1.5">{t.counterparty_name ?? "—"}</td>
                  <td className="py-1.5 text-right tabular-nums"><CurrencyText value={t.amount} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border border-border rounded-lg bg-card p-4">
          <h3 className="text-sm font-semibold mb-2">
            Verkoopfacturen zonder lidkoppeling ({unmatched?.length ?? 0})
          </h3>
          <p className="text-xs text-muted-foreground mb-2">Uitzonderingen — deze worden niet stil overgeslagen.</p>
          <table className="w-full text-sm">
            <tbody>
              {(unmatched ?? []).slice(0, 25).map((e) => (
                <tr key={e.informer_id} className="border-b border-border/40 last:border-0">
                  <td className="py-1.5">{e.entry_date ?? "—"}</td>
                  <td className="py-1.5">{e.relation_name ?? e.invoice_number ?? "—"}</td>
                  <td className="py-1.5 text-right tabular-nums"><CurrencyText value={e.amount_incl} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
