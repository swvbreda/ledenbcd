import { useMemo } from "react";
import { CurrencyCell, CurrencyText } from "@/components/budget/CurrencyAmount";
import { Checkbox } from "@/components/ui/checkbox";
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
  onToggleExpensePaid: (id: string, paid: boolean) => void;
}

export default function OpenstaandePostenTab({ categories, contributions, members, year, contributionAmount, onToggleExpensePaid }: Props) {
  // Crediteuren: onbetaalde uitgaven
  const unpaidCreditors = useMemo(() => {
    const all = categories.flatMap((cat) =>
      cat.line_items.flatMap((li) =>
        li.expenses
          .filter((exp) => !exp.paid && exp.direction !== "in")
          .map((exp) => ({
            id: exp.id,
            date: exp.expense_date || "",
            name: exp.creditor_name || exp.description || "",
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

  const totalCreditors = unpaidCreditors.reduce((s, c) => s + c.amount, 0);
  const totalDebtors = debtors.length * contributionAmount;

  return (
    <div className="mt-4 grid grid-cols-1 xl:grid-cols-2 gap-4">
      {/* Crediteuren — openstaand */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Crediteuren — openstaand ({unpaidCreditors.length})</h3>
          <span className="text-xs text-muted-foreground">
            Totaal: <CurrencyText value={totalCreditors} />
          </span>
        </div>
        <div className="border border-border rounded-lg overflow-hidden max-h-[65vh] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
              <tr className="border-b border-border">
                <th className="px-2 py-1.5 w-8" />
                <th className="px-2 py-1.5 text-left font-medium">Datum</th>
                <th className="px-2 py-1.5 text-left font-medium">Crediteur</th>
                <th className="px-2 py-1.5 text-left font-medium">Factuurnr</th>
                <th className="px-2 py-1.5 text-right font-medium">Bedrag</th>
              </tr>
            </thead>
            <tbody>
              {unpaidCreditors.length === 0 ? (
                <tr><td colSpan={5} className="px-2 py-4 text-center text-muted-foreground">Alle crediteuren zijn betaald ✓</td></tr>
              ) : (
                unpaidCreditors.map((c) => (
                  <tr key={c.id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="px-2 py-1">
                      <Checkbox
                        checked={false}
                        onCheckedChange={() => onToggleExpensePaid(c.id, true)}
                        title="Markeer als betaald"
                      />
                    </td>
                    <td className="px-2 py-1 whitespace-nowrap tabular-nums">{c.date || ""}</td>
                    <td className="px-2 py-1">{c.name}</td>
                    <td className="px-2 py-1 tabular-nums">{c.invoice || ""}</td>
                    <td className="px-2 py-1 text-right"><CurrencyCell value={c.amount} /></td>
                  </tr>
                ))
              )}
            </tbody>
            {unpaidCreditors.length > 0 && (
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

      {/* Debiteuren — openstaand */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Debiteuren — openstaand ({debtors.length})</h3>
          <span className="text-xs text-muted-foreground">
            Totaal: <CurrencyText value={totalDebtors} />
          </span>
        </div>
        <div className="border border-border rounded-lg overflow-hidden max-h-[65vh] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
              <tr className="border-b border-border">
                <th className="px-2 py-1.5 text-left font-medium">Lid</th>
                <th className="px-2 py-1.5 text-right font-medium">Bedrag</th>
              </tr>
            </thead>
            <tbody>
              {debtors.length === 0 ? (
                <tr><td colSpan={2} className="px-2 py-4 text-center text-muted-foreground">Alle leden hebben betaald ✓</td></tr>
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
