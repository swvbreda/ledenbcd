import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CurrencyCell } from "@/components/budget/CurrencyAmount";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  year: number;
}

interface ReconRow {
  member_id: number | null;
  member_name: string | null;
  bank_amount: number;
  invoice_amount: number | null;
  invoice_number: string | null;
  marked_paid: number;
  category: "ok" | "no_invoice" | "no_bank" | "orphan" | "amount_mismatch";
  bank_date: string | null;
  counterparty: string | null;
  dossier: string | null;
}

function useReconciliation(year: number) {
  return useQuery({
    queryKey: ["harde-check", year],
    queryFn: async () => {
      const [ptRes, btRes, invRes, payRes, memRes] = await Promise.all([
        supabase
          .from("ponto_transactions")
          .select("id, value_date, executed_at, amount, counterparty_name, counterparty_iban, description, remittance_info, dossier, match_strategy")
          .gt("amount", 0)
          .order("value_date", { ascending: true }),
        supabase
          .from("bank_transactions")
          .select("id, transaction_date, amount, counterparty, description, invoice_reference, dossier, year")
          .eq("direction", "in")
          .eq("year", year)
          .order("transaction_date", { ascending: true }),
        supabase
          .from("contribution_invoices")
          .select("id, member_id, year, invoice_number, amount")
          .eq("year", year),
        supabase
          .from("contribution_payments")
          .select("member_id, year, amount, status, payment_method, paid_at")
          .eq("year", year)
          .eq("status", "paid"),
        supabase.from("members_data").select("id, data").in("member_type", ["member", "lead", "old"]),
      ]);

      const memberName = (id: number | null) => {
        if (id == null) return null;
        const m = (memRes.data ?? []).find((x: any) => x.id === id);
        const d: any = m?.data || {};
        return (d.naam || d.bedrijfsnaam || `Lid #${id}`) as string;
      };

      const allPonto = ptRes.data ?? [];
      const pontoRows = allPonto.filter(
        (t: any) => {
          const d = (t.value_date ?? t.executed_at ?? "").slice(0, 4);
          return d === String(year);
        },
      );
      const bankTxRows = (btRes.data ?? []).map((t: any) => ({
        id: t.id,
        value_date: t.transaction_date,
        amount: Number(t.amount),
        counterparty_name: t.counterparty,
        description: t.description,
        dossier: t.dossier,
      }));
      const bankRows = [
        ...pontoRows.map((t: any) => ({ ...t, amount: Number(t.amount) })),
        ...bankTxRows,
      ];

      const invoices = invRes.data ?? [];
      const payments = payRes.data ?? [];

      // Aggregate marked-paid per member — this is the source of truth: bank imports,
      // Ponto matches and manual corrections all funnel into contribution_payments.
      const paidByMember = new Map<number, number>();
      for (const p of payments) {
        paidByMember.set(p.member_id, (paidByMember.get(p.member_id) ?? 0) + Number(p.amount));
      }

      // Aggregate bank per member for reference (from dossier "Contributie #<id>")
      const bankByMember = new Map<number, { total: number; rows: any[] }>();
      const orphanBank: any[] = [];
      const nonContributionBank: any[] = [];
      for (const t of bankRows) {
        const m = (t.dossier || "").match(/Contributie\s*#(\d+)/i);
        if (m) {
          const id = Number(m[1]);
          const entry = bankByMember.get(id) ?? { total: 0, rows: [] };
          entry.total += Number(t.amount);
          entry.rows.push(t);
          bankByMember.set(id, entry);
        } else if ((t.dossier || "").toLowerCase().includes("contributie")) {
          orphanBank.push(t);
        } else {
          nonContributionBank.push(t);
        }
      }

      // Build reconciliation per member (union of bank + invoices + payments)
      const memberIds = new Set<number>([
        ...bankByMember.keys(),
        ...invoices.map((i: any) => i.member_id as number),
        ...paidByMember.keys(),
      ]);

      const rows: ReconRow[] = [];
      for (const id of memberIds) {
        const bank = bankByMember.get(id);
        const inv = invoices.find((i: any) => i.member_id === id);
        const paid = paidByMember.get(id) ?? 0;
        const bankTotal = bank?.total ?? 0;
        const invAmt = inv ? Number(inv.amount ?? 0) : 0;

        // Reconciliatie op basis van geregistreerde betalingen (contribution_payments),
        // niet enkel de bank-dossier-koppeling — handmatige correcties tellen zo mee.
        let category: ReconRow["category"] = "ok";
        if (paid > 0 && !inv) category = "no_invoice";
        else if (inv && paid < invAmt - 5) category = "no_bank";
        else if (inv && paid > invAmt + 5) category = "amount_mismatch";

        rows.push({
          member_id: id,
          member_name: memberName(id),
          bank_amount: bankTotal,
          invoice_amount: inv ? invAmt : null,
          invoice_number: inv?.invoice_number ?? null,
          marked_paid: paid,
          category,
          bank_date: bank?.rows[0]?.value_date ?? null,
          counterparty: bank?.rows[0]?.counterparty_name ?? null,
          dossier: bank?.rows[0]?.dossier ?? null,
        });
      }

      // Orphan: bank income with dossier "Contributie (handmatig)" — no member link
      for (const t of orphanBank) {
        rows.push({
          member_id: null,
          member_name: null,
          bank_amount: Number(t.amount),
          invoice_amount: null,
          invoice_number: null,
          marked_paid: 0,
          category: "orphan",
          bank_date: t.value_date,
          counterparty: t.counterparty_name,
          dossier: t.dossier,
        });
      }

      // Totals
      const totals = {
        bank_in: bankRows.reduce((s: number, t: any) => s + Number(t.amount), 0),
        bank_contribution: [...bankByMember.values()].reduce((s, v) => s + v.total, 0) +
          orphanBank.reduce((s, t) => s + Number(t.amount), 0),
        invoices_total: invoices.reduce((s: number, i: any) => s + Number(i.amount ?? 0), 0),
        invoices_count: invoices.length,
        payments_total: payments.reduce((s: number, p: any) => s + Number(p.amount), 0),
        payments_count: payments.length,
        non_contribution: nonContributionBank.reduce((s, t) => s + Number(t.amount), 0),
      };

      const earliestBank = bankRows.length
        ? bankRows.reduce((min: string | null, t: any) => {
            const d = t.value_date ?? null;
            if (!d) return min;
            return !min || d < min ? d : min;
          }, null as string | null)
        : null;

      return { rows, totals, nonContributionBank, earliestBank };
    },
  });
}

export default function HardeCheckTab({ year }: Props) {
  const { data, isLoading } = useReconciliation(year);

  if (isLoading || !data) {
    return <div className="p-8 text-sm text-muted-foreground">Bezig met controleren…</div>;
  }

  const { rows, totals, nonContributionBank, earliestBank } = data;
  const problems = rows.filter((r) => r.category !== "ok");
  const bankCoverStart = earliestBank ? new Date(earliestBank).toLocaleDateString("nl-NL") : "onbekend";

  const badge = (cat: ReconRow["category"]) => {
    const map: Record<ReconRow["category"], { label: string; className: string }> = {
      ok: { label: "OK", className: "bg-green-100 text-green-800" },
      no_invoice: { label: "Geen Informer-factuur", className: "bg-red-100 text-red-800" },
      no_bank: { label: "Nog niet ontvangen op bank", className: "bg-amber-100 text-amber-800" },
      amount_mismatch: { label: "Bedrag wijkt af", className: "bg-orange-100 text-orange-800" },
      orphan: { label: "Bank niet gekoppeld aan lid", className: "bg-purple-100 text-purple-800" },
    };
    const b = map[cat];
    return <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${b.className}`}>{b.label}</span>;
  };

  return (
    <div className="space-y-4">
      <div className="border border-border rounded-lg p-4 bg-muted/30 flex items-start gap-3">
        <Info className="text-primary mt-0.5 shrink-0" size={18} />
        <div className="text-sm">
          <div className="font-semibold mb-1">Bank-leidende reconciliatie voor {year}</div>
          <div className="text-muted-foreground">
            Vergelijking tussen daadwerkelijke bankboekingen (Ponto + ABN-import), Informer-facturen en de geregistreerde betalingen per lid.
            Bankdata beschikbaar vanaf <span className="font-medium">{bankCoverStart}</span>.
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Bank inkomsten totaal" value={totals.bank_in} />
        <StatCard label="Bank contributies" value={totals.bank_contribution} />
        <StatCard label="Informer facturen" value={totals.invoices_total} sub={`${totals.invoices_count} facturen`} />
        <StatCard label="Gemarkeerd betaald" value={totals.payments_total} sub={`${totals.payments_count} betalingen`} />
      </div>

      <div className="border border-border rounded-lg overflow-hidden">
        <div className="px-3 py-2 bg-muted/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className="text-orange-600" />
            <h3 className="text-sm font-semibold">Verschillen ({problems.length})</h3>
          </div>
          {problems.length === 0 && (
            <span className="text-xs text-green-700 flex items-center gap-1">
              <CheckCircle2 size={12} /> Alles klopt
            </span>
          )}
        </div>
        {problems.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/20 text-xs text-muted-foreground">
                <th className="text-left px-3 py-2 font-medium">Lid</th>
                <th className="text-left px-3 py-2 font-medium">Status</th>
                <th className="text-right px-3 py-2 font-medium">Bank</th>
                <th className="text-right px-3 py-2 font-medium">Informer factuur</th>
                <th className="text-right px-3 py-2 font-medium">Gemarkeerd betaald</th>
                <th className="text-left px-3 py-2 font-medium">Toelichting</th>
              </tr>
            </thead>
            <tbody>
              {problems.map((r, i) => (
                <tr key={i} className="border-b border-border/50 hover:bg-muted/20">
                  <td className="px-3 py-2">
                    {r.member_id ? (
                      <div>
                        <div className="font-medium">{r.member_name}</div>
                        <div className="text-xs text-muted-foreground">#{r.member_id}</div>
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground italic">Onbekend lid</div>
                    )}
                  </td>
                  <td className="px-3 py-2">{badge(r.category)}</td>
                  <td className="text-right px-3 py-2 tabular-nums">
                    {r.bank_amount > 0 ? <CurrencyCell value={r.bank_amount} /> : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="text-right px-3 py-2 tabular-nums">
                    {r.invoice_amount != null ? (
                      <div>
                        <CurrencyCell value={r.invoice_amount} />
                        {r.invoice_number && <div className="text-[10px] text-muted-foreground">{r.invoice_number}</div>}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="text-right px-3 py-2 tabular-nums">
                    {r.marked_paid > 0 ? <CurrencyCell value={r.marked_paid} /> : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {r.category === "no_invoice" && `Bankbetaling ontvangen (${r.counterparty ?? "?"}), maar géén factuur in Informer voor ${year}.`}
                    {r.category === "no_bank" && "Factuur staat in Informer maar geen bijpassende bankontvangst gevonden."}
                    {r.category === "amount_mismatch" && "Bank en Informer-factuur bedragen komen niet overeen."}
                    {r.category === "orphan" && `${r.counterparty ?? "?"} — ${r.bank_date} — kon niet automatisch aan een lid worden gekoppeld.`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="border border-border rounded-lg overflow-hidden">
        <div className="px-3 py-2 bg-muted/50">
          <h3 className="text-sm font-semibold">Niet-contributie bankinkomsten ({nonContributionBank.length})</h3>
        </div>
        {nonContributionBank.length === 0 ? (
          <div className="p-3 text-xs text-muted-foreground">Geen</div>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {nonContributionBank.map((t: any) => (
                <tr key={t.id} className="border-b border-border/50">
                  <td className="px-3 py-1.5 text-xs">{t.value_date}</td>
                  <td className="px-3 py-1.5">{t.counterparty_name}</td>
                  <td className="text-right px-3 py-1.5 tabular-nums"><CurrencyCell value={Number(t.amount)} /></td>
                </tr>
              ))}
              <tr className="bg-primary/5 font-semibold">
                <td className="px-3 py-2" colSpan={2}>Totaal</td>
                <td className="text-right px-3 py-2 tabular-nums"><CurrencyCell value={totals.non_contribution} /></td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="border border-border rounded-lg p-3 bg-background">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold tabular-nums mt-1"><CurrencyCell value={value} /></div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}