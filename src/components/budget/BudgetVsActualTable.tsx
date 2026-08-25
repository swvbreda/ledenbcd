import { CurrencyCell, CurrencyText } from "@/components/budget/CurrencyAmount";
import type { BudgetCategory } from "@/hooks/useBudget";

interface Props {
  categories: BudgetCategory[];
  year: number;
}

export default function BudgetVsActualTable({ categories, year }: Props) {
  if (categories.length === 0) return null;

  // Only expense categories — inkomstenposten (bv. contributies, subsidies) horen
  // niet in "uitgegeven van begroot".
  const expenseCategories = categories.filter(
    (c) => !/inkomst|contribut|subsid|opbreng/i.test(c.name)
  );

  const perCat = expenseCategories
    .map((cat) => {
      const budgeted = cat.line_items.reduce((sum, li) => sum + Number(li.budgeted_amount || 0), 0);
      // Alleen betaalde uitgaven tellen mee.
      const spentPerLine = cat.line_items.map((li) =>
        li.expenses.reduce(
          (es, e) => es + (e.direction === "in" || e.paid === false ? 0 : Number(e.amount || 0)),
          0
        )
      );
      const spent = spentPerLine.reduce((s, v) => s + v, 0);
      const available = cat.line_items.reduce(
        (s, li, i) => s + Math.max(Number(li.budgeted_amount || 0) - spentPerLine[i], 0),
        0
      );
      const overrun = cat.line_items.reduce(
        (s, li, i) => s + Math.min(Number(li.budgeted_amount || 0) - spentPerLine[i], 0),
        0
      );
      return { id: cat.id, name: cat.name, budgeted, spent, available, overrun };
    })
    .sort((a, b) => b.spent - a.spent);

  const totalBudgeted = perCat.reduce((s, c) => s + c.budgeted, 0);
  const totalSpent = perCat.reduce((s, c) => s + c.spent, 0);
  const totalAvailable = perCat.reduce((s, c) => s + c.available, 0);
  const totalOverrun = perCat.reduce((s, c) => s + c.overrun, 0);
  const over = totalSpent > totalBudgeted && totalBudgeted > 0;
  const pct = totalBudgeted > 0 ? Math.min(100, Math.round((totalSpent / totalBudgeted) * 100)) : 0;

  return (
    <div className="border border-border rounded-lg bg-card p-3 space-y-3">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h3 className="text-sm font-semibold">Begroting vs Werkelijk — {year}</h3>
        <div className="text-xs text-muted-foreground">
          <span className="tabular-nums"><CurrencyText value={totalSpent} /></span>
          {" uitgegeven van "}
          <span className="tabular-nums"><CurrencyText value={totalBudgeted} /></span>
          {" · beschikbaar "}
          <span className="tabular-nums font-medium text-green-600">
            <CurrencyText value={totalAvailable} />
          </span>
          {totalOverrun < 0 && (
            <>
              {" · overschreden "}
              <span className="tabular-nums font-medium text-destructive">
                <CurrencyText value={totalOverrun} />
              </span>
            </>
          )}
        </div>
      </div>

      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full ${over ? "bg-destructive" : "bg-brand-red"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-muted-foreground border-b border-border/40">
            <th className="text-left font-medium py-1">Categorie</th>
            <th className="text-right font-medium py-1">Begroot</th>
            <th className="text-right font-medium py-1">Uitgegeven</th>
            <th className="text-right font-medium py-1 w-16">%</th>
            <th className="text-right font-medium py-1">Resterend</th>
          </tr>
        </thead>
        <tbody>
          {perCat.map((c) => {
            const catPct = c.budgeted > 0 ? Math.round((c.spent / c.budgeted) * 100) : 0;
            const catOver = c.spent > c.budgeted && c.budgeted > 0;
            return (
              <tr key={c.id} className="border-b border-border/20">
                <td className="py-1">{c.name}</td>
                <td className="py-1 text-right tabular-nums"><CurrencyCell value={c.budgeted} /></td>
                <td className="py-1 text-right tabular-nums"><CurrencyCell value={c.spent} /></td>
                <td className={`py-1 text-right tabular-nums ${catOver ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                  {c.budgeted > 0 ? `${catPct}%` : "—"}
                </td>
                <td className={`py-1 text-right tabular-nums ${catOver ? "text-destructive" : ""}`}>
                  <CurrencyCell value={c.budgeted - c.spent} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
