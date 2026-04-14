import { useMemo } from "react";
import { CurrencyCell, CurrencyText } from "@/components/budget/CurrencyAmount";
import type { BudgetCategory } from "@/hooks/useBudget";
import type { Contribution } from "@/hooks/useContributions";

interface MemberOption {
  id: number;
  naam: string;
}

interface Props {
  categories: BudgetCategory[];
  contributions: Contribution[];
  members: MemberOption[];
  year: number;
  contributionAmount: number;
}

export default function OpenstaandePostenTab({ categories, contributions, members, year, contributionAmount }: Props) {
  // Crediteuren: alle uitgaven (budget_expenses) — deze zijn altijd "openstaand" als ze bestaan
  const creditors = useMemo(() => {
    const all = categories.flatMap((cat) =>
      cat.line_items.flatMap((li) =>
        li.expenses.map((exp) => ({
          date: exp.expense_date || "",
          name: exp.creditor_name || exp.description || "–",
          invoice: exp.invoice_reference || "",
          amount: exp.amount,
          category: `${cat.name} → ${li.name}`,
        }))
      )
    );
    return all.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [categories]);

  // Debiteuren: leden die nog niet betaald hebben
  const debtors = useMemo(() => {
    const paidMemberIds = new Set(
      contributions.filter((c) => c.paid).map((c) => c.member_id)
    );
    return members
      .filter((m) => !paidMemberIds.has(m.id))
      .sort((a, b) => a.naam.localeCompare(b.naam, "nl"));
  }, [contributions, members]);

  const totalCreditors = creditors.reduce((s, c) => s + c.amount, 0);
  const totalDebtors = debtors.length * contributionAmount;

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

      {/* Debiteuren — openstaand (niet betaald) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Debiteuren — openstaand ({debtors.length})</h3>
          <span className="text-xs text-muted-foreground">
            Totaal: <CurrencyText value={totalDebtors} />
          </span>
        </div>
        <div className="border border-border rounded-lg overflow-hidden max-h-[65vh] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-muted/80 backdrop-blur">
              <tr className="border-b border-border">
                <th className="px-2 py-1.5 text-left font-medium">Lid</th>
                <th className="px-2 py-1.5 text-right font-medium">Bedrag</th>
              </tr>
            </thead>
            <tbody>
              {debtors.length === 0 ? (
                <tr><td colSpan={2} className="px-2 py-4 text-center text-muted-foreground">Geen openstaande debiteuren voor {year}</td></tr>
              ) : (
                debtors.map((d) => (
                  <tr key={d.id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="px-2 py-1">{d.naam}</td>
                    <td className="px-2 py-1 text-right tabular-nums"><CurrencyCell value={contributionAmount} /></td>
                  </tr>
                ))
              )}
            </tbody>
            {debtors.length > 0 && (
              <tfoot>
                <tr className="bg-primary/5 font-semibold border-t border-border">
                  <td className="px-2 py-1.5">Totaal</td>
                  <td className="px-2 py-1.5 text-right"><CurrencyCell value={totalDebtors} /></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
