import { useMemo } from "react";
import { CurrencyCell, CurrencyText } from "@/components/budget/CurrencyAmount";
import type { BudgetCategory } from "@/hooks/useBudget";

interface ContributionInvoice {
  id: string;
  member_id: number;
  invoice_number: string | null;
  year: number;
}

interface MemberOption {
  id: number;
  naam: string;
}

interface Props {
  categories: BudgetCategory[];
  contributions: ContributionInvoice[];
  members: MemberOption[];
  year: number;
}

export default function CrediteurenDebiteurenTab({ categories, contributions, members, year }: Props) {
  const creditors = useMemo(() => {
    const all = categories.flatMap((cat) =>
      cat.line_items.flatMap((li) =>
        li.expenses.map((exp) => ({
          date: exp.expense_date || "",
          name: exp.creditor_name || exp.description || "–",
          invoice: exp.invoice_reference || "",
          dossier: exp.dossier || "",
          amount: exp.amount,
          category: `${cat.name} → ${li.name}`,
        }))
      )
    );
    return all.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [categories]);

  const debtors = useMemo(() => {
    const memberMap = new Map(members.map((m) => [m.id, m.naam]));
    return contributions
      .map((c) => ({
        name: memberMap.get(c.member_id) || `Lid #${c.member_id}`,
        invoice: c.invoice_number || "",
        member_id: c.member_id,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "nl"));
  }, [contributions, members]);

  const totalCreditors = creditors.reduce((s, c) => s + c.amount, 0);

  return (
    <div className="mt-4 grid grid-cols-1 xl:grid-cols-2 gap-4">
      {/* Crediteuren */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Crediteuren ({creditors.length})</h3>
          <span className="text-xs text-muted-foreground">
            Totaal: <CurrencyText value={totalCreditors} />
          </span>
        </div>
        <div className="border border-border rounded-lg overflow-hidden max-h-[65vh] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-muted/80 backdrop-blur">
              <tr className="border-b border-border">
                <th className="px-2 py-1.5 text-left font-medium">Datum</th>
                <th className="px-2 py-1.5 text-left font-medium">Crediteur</th>
                <th className="px-2 py-1.5 text-left font-medium">Factuurnr</th>
                <th className="px-2 py-1.5 text-left font-medium">Begrotingspost</th>
                <th className="px-2 py-1.5 text-right font-medium">Bedrag</th>
              </tr>
            </thead>
            <tbody>
              {creditors.length === 0 ? (
                <tr><td colSpan={5} className="px-2 py-4 text-center text-muted-foreground">Geen crediteuren voor {year}</td></tr>
              ) : (
                creditors.map((c, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="px-2 py-1 whitespace-nowrap tabular-nums">{c.date || "–"}</td>
                    <td className="px-2 py-1">{c.name}</td>
                    <td className="px-2 py-1 tabular-nums">{c.invoice || "–"}</td>
                    <td className="px-2 py-1 text-muted-foreground">{c.category}</td>
                    <td className="px-2 py-1 text-right"><CurrencyCell value={c.amount} /></td>
                  </tr>
                ))
              )}
            </tbody>
            {creditors.length > 0 && (
              <tfoot>
                <tr className="bg-primary/5 font-semibold border-t border-border">
                  <td colSpan={4} className="px-2 py-1.5">Totaal</td>
                  <td className="px-2 py-1.5 text-right"><CurrencyCell value={totalCreditors} /></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Debiteuren */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Debiteuren ({debtors.length})</h3>
        </div>
        <div className="border border-border rounded-lg overflow-hidden max-h-[65vh] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-muted/80 backdrop-blur">
              <tr className="border-b border-border">
                <th className="px-2 py-1.5 text-left font-medium">Lid</th>
                <th className="px-2 py-1.5 text-left font-medium">Factuurnr</th>
              </tr>
            </thead>
            <tbody>
              {debtors.length === 0 ? (
                <tr><td colSpan={2} className="px-2 py-4 text-center text-muted-foreground">Geen debiteuren voor {year}</td></tr>
              ) : (
                debtors.map((d, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="px-2 py-1">{d.name}</td>
                    <td className="px-2 py-1 tabular-nums">{d.invoice || "–"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
